import type {
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalOutput,
  TerminalSubscription
} from "./terminal";
import type { DaemonBridgeClient } from "./hubTransport";
import { hubTerminalSubscriptionId } from "./hubTransport";
import type { DaemonCaptureSnapshot, DaemonEvent, DaemonReadScreen } from "./realHubDaemonDto";

const maxHydrationBufferBytes = 16_777_216;
let nextSubscriptionSequence = 1;

interface ScreenHydration {
  generation: number;
  bufferedOutput: string[];
  bufferedBytes: number;
  pendingExit?: number | null;
}

export interface HubTerminalDataPlaneOptions {
  bridge: DaemonBridgeClient;
  sessionId?: string;
  subscriptionId?: string;
}

export class HubTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly sessionId: string;

  private readonly subscriptionId: string;
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private readonly statusListeners = new Set<(status: TerminalAttachmentStatus) => void>();
  private currentStatus: TerminalAttachmentStatus = {
    state: "attaching",
    message: "Attaching terminal stream."
  };
  private streamSubscription: { unsubscribe(): void } | undefined;
  private attachPromise: Promise<void> | undefined;
  private pendingResize: { rows: number; columns: number } | undefined;
  private detached = false;
  private attachmentGeneration = 0;
  private hydration: ScreenHydration | undefined;
  private hydratedGeneration: number | undefined;
  private restoredVisibleScreenGeneration: number | undefined;

  constructor(private readonly options: HubTerminalDataPlaneOptions) {
    if (!options.sessionId) throw new Error("Hub terminal data plane requires a session id.");
    this.sessionId = options.sessionId;
    this.subscriptionId = options.subscriptionId ?? createTerminalSubscriptionId();
  }

  async writeInput(data: string): Promise<void> {
    recordLiveHarnessTerminal("input", { data });
    await this.ensureAttached();
    await this.options.bridge.request({
      type: "send_input",
      session_id: this.sessionId,
      data
    });
  }

  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription {
    this.listeners.add(listener);
    this.detached = false;
    this.emitStatus({
      state: "attaching",
      message: "Attaching terminal stream."
    });
    void this.ensureAttached().catch((error: unknown) => {
      this.emitStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Terminal stream attach failed."
      });
      recordLiveHarnessTerminal("attach_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    });

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
        if (this.listeners.size === 0) {
          this.closeStream();
        }
      }
    };
  }

  subscribeStatus(listener: (status: TerminalAttachmentStatus) => void): TerminalSubscription {
    this.statusListeners.add(listener);
    listener(this.currentStatus);

    return {
      unsubscribe: () => {
        this.statusListeners.delete(listener);
      }
    };
  }

  async resize(rows: number, columns: number): Promise<void> {
    recordLiveHarnessTerminal("resize", { rows, columns });
    this.pendingResize = { rows, columns };
    await this.ensureAttached();
    await this.flushPendingResize();
  }

  async readScreen(): Promise<DaemonReadScreen | undefined> {
    const attachmentGeneration = this.attachmentGeneration;
    const response = await this.options.bridge.request({
      type: "read_screen",
      session_id: this.sessionId
    });
    const readScreen = response.read_screen ?? undefined;
    if (!this.isCurrentAttachment(attachmentGeneration) || readScreen?.session_id !== this.sessionId) {
      return undefined;
    }
    return readScreen;
  }

  async captureSnapshot(): Promise<DaemonCaptureSnapshot | undefined> {
    const attachmentGeneration = this.attachmentGeneration;
    const response = await this.options.bridge.request({
      type: "capture_snapshot",
      session_id: this.sessionId
    });
    const captureSnapshot = response.capture_snapshot ?? undefined;
    if (!this.isCurrentAttachment(attachmentGeneration) || captureSnapshot?.session_id !== this.sessionId) {
      return undefined;
    }
    return captureSnapshot;
  }

  async detach(): Promise<void> {
    this.detached = true;
    this.closeStream();
    this.listeners.clear();
    this.statusListeners.clear();

    await this.options.bridge.request({
      type: "detach",
      session_id: this.sessionId,
      subscription_id: this.subscriptionId
    });
  }

  private ensureAttached(): Promise<void> {
    if (this.streamSubscription || (this.detached && this.listeners.size === 0)) {
      return Promise.resolve();
    }

    if (!this.options.bridge.streamTerminal) {
      throw new Error("WebRTC client does not expose terminal streaming.");
    }

    if (!this.attachPromise) {
      const attachPromise = this.attachToAuthoritativeSession();
      this.attachPromise = attachPromise;
      void attachPromise.finally(() => {
        if (this.attachPromise === attachPromise) {
          this.attachPromise = undefined;
        }
      });
    }

    return this.attachPromise;
  }

  private isCurrentAttachment(attachmentGeneration: number): boolean {
    return !this.detached && this.attachmentGeneration === attachmentGeneration;
  }

  private async attachToAuthoritativeSession(): Promise<void> {
    if (this.streamSubscription || (this.detached && this.listeners.size === 0) || this.listeners.size === 0) {
      return;
    }

    const attachmentGeneration = ++this.attachmentGeneration;
    const streamSubscription = this.options.bridge.streamTerminal!(
      this.sessionId,
      this.subscriptionId,
      (event) => this.emitTerminalEvent(event, attachmentGeneration)
    );
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      streamSubscription.unsubscribe();
      return;
    }
    this.streamSubscription = streamSubscription;
    recordLiveHarnessTerminal("attach", { attempt: 1 });
    await this.flushPendingResize();
  }

  private closeStream(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = undefined;
    this.attachPromise = undefined;
    this.attachmentGeneration += 1;
    this.hydration = undefined;
    this.hydratedGeneration = undefined;
    this.restoredVisibleScreenGeneration = undefined;
  }

  private async flushPendingResize(): Promise<void> {
    if (!this.streamSubscription || !this.pendingResize) return;

    const resize = this.pendingResize;
    this.pendingResize = undefined;
    await this.options.bridge.request({
      type: "resize",
      session_id: this.sessionId,
      rows: resize.rows,
      cols: resize.columns
    });
  }

  private emitTerminalEvent(event: DaemonEvent, attachmentGeneration: number): void {
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return;
    }

    if (!isTerminalStreamEvent(event) || event.session_id !== this.sessionId || event.subscription_id !== this.subscriptionId) {
      return;
    }

    if (event.type === "attach_state") {
      this.emitStatus(attachStateStatus(event.state));
      if (event.state === "attached") {
        this.beginScreenHydration(attachmentGeneration);
      }
      recordLiveHarnessTerminal("attach_state", { state: event.state });
      return;
    }

    if (event.type === "process_exit") {
      if (this.hydration?.generation === attachmentGeneration) {
        this.hydration.pendingExit = event.code;
        return;
      }
      this.emitProcessExit(event.code);
      return;
    }

    if (event.type === "snapshot" || event.type === "scrollback") {
      recordLiveHarnessTerminal(event.type, {
        bytes: event.bytes,
        payload_encoding: event.payload_encoding
      });
      return;
    }

    if (event.type === "terminal_output") {
      if (this.hydration?.generation === attachmentGeneration) {
        this.bufferHydratingOutput(event.data, this.hydration);
        return;
      }
      if (
        this.currentStatus.state === "attaching" ||
        (this.currentStatus.state === "attached" && this.restoredVisibleScreenGeneration !== attachmentGeneration)
      ) {
        this.emitStatus({
          state: "live_only",
          message: "Terminal stream attached live; no visible screen content was restored."
        });
      }
      this.emitOutput(event.data, "output");
    }
  }

  private beginScreenHydration(attachmentGeneration: number): void {
    if (this.hydratedGeneration === attachmentGeneration) {
      return;
    }

    this.hydratedGeneration = attachmentGeneration;
    const hydration: ScreenHydration = {
      generation: attachmentGeneration,
      bufferedOutput: [],
      bufferedBytes: 0
    };
    this.hydration = hydration;
    void this.hydrateVisibleScreen(hydration);
  }

  private async hydrateVisibleScreen(hydration: ScreenHydration): Promise<void> {
    try {
      const response = await this.options.bridge.request({
        type: "read_screen",
        session_id: this.sessionId
      });
      const readScreen = response.read_screen ?? undefined;
      if (!this.isCurrentAttachment(hydration.generation) || this.hydration !== hydration) {
        return;
      }
      if (readScreen && readScreen.session_id !== this.sessionId) {
        throw new Error(`Terminal screen readback returned session ${readScreen.session_id}; expected ${this.sessionId}.`);
      }

      this.hydration = undefined;
      if (readScreen?.text) {
        this.restoredVisibleScreenGeneration = hydration.generation;
        this.emitStatus({
          state: "attached",
          message: "Visible terminal screen restored from daemon readback."
        });
        this.emitOutput(readScreen.text, "read_screen");
      } else if (hydration.bufferedOutput.length > 0) {
        this.emitStatus({
          state: "live_only",
          message: "Terminal stream attached live; no visible screen content was restored."
        });
      }

      for (const data of hydration.bufferedOutput) {
        this.emitOutput(data, "output");
      }
      if (hydration.pendingExit !== undefined) {
        this.emitProcessExit(hydration.pendingExit);
      }
    } catch (error: unknown) {
      if (!this.isCurrentAttachment(hydration.generation) || this.hydration !== hydration) {
        return;
      }
      this.hydration = undefined;
      this.emitStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Terminal screen readback failed."
      });
      recordLiveHarnessTerminal("read_screen_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      this.closeStream();
    }
  }

  private bufferHydratingOutput(data: string, hydration: ScreenHydration): void {
    const bufferedBytes = hydration.bufferedBytes + new TextEncoder().encode(data).byteLength;
    if (bufferedBytes > maxHydrationBufferBytes) {
      this.hydration = undefined;
      this.emitStatus({
        state: "failed",
        message: "Terminal screen readback exceeded the live-output buffer limit."
      });
      recordLiveHarnessTerminal("read_screen_buffer_exceeded", { buffered_bytes: bufferedBytes });
      this.closeStream();
      return;
    }

    hydration.bufferedOutput.push(data);
    hydration.bufferedBytes = bufferedBytes;
  }

  private emitOutput(data: TerminalOutput, kind: "output" | "read_screen"): void {
    for (const listener of this.listeners) {
      listener(data);
    }
    recordLiveHarnessTerminal("output", { data, source: kind });
  }

  private emitProcessExit(code: number | null): void {
    this.emitStatus({
      state: "exited",
      message: typeof code === "number"
        ? `Terminal process exited with ${code}.`
        : "Terminal process exited."
    });
    recordLiveHarnessTerminal("process_exit", { code });
  }

  private emitStatus(status: TerminalAttachmentStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
    recordLiveHarnessTerminal("status", status);
  }
}

function isTerminalStreamEvent(event: DaemonEvent): event is Extract<
  DaemonEvent,
  { session_id: string; subscription_id: string }
> {
  return "session_id" in event && "subscription_id" in event;
}

function attachStateStatus(state: string): TerminalAttachmentStatus {
  if (state === "attached") {
    return {
      state: "attached",
      message: "Terminal stream attached; waiting for available output."
    };
  }

  return {
    state: "attaching",
    message: `Terminal stream state: ${state}.`
  };
}

export function createHubTerminalDataPlane(options: HubTerminalDataPlaneOptions): TerminalDataPlaneAttachment {
  return new HubTerminalDataPlane(options);
}

function createTerminalSubscriptionId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) {
    return `${hubTerminalSubscriptionId}-${randomId}`;
  }

  return `${hubTerminalSubscriptionId}-${Date.now()}-${nextSubscriptionSequence++}`;
}

function recordLiveHarnessTerminal(kind: string, payload: unknown): void {
  if (typeof window === "undefined") return;

  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      terminal?: Array<{ kind: string; payload: unknown }>;
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  harness?.terminal?.push({ kind, payload });
}
