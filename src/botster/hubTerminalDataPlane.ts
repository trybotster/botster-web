import type {
  ModeDependentTerminalInput,
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalOutput,
  TerminalSubscription
} from "./terminal";
import type { DaemonBridgeClient } from "./hubTransport";
import { hubTerminalSubscriptionId } from "./hubTransport";
import type {
  DaemonCaptureSnapshot,
  DaemonEvent,
  DaemonModeFlags,
  DaemonModeGatedInputResult,
  DaemonReadScreen
} from "./realHubDaemonDto";

const maxHydrationBufferBytes = 16_777_216;
const ghostsnpMagic = "GHOSTSNP";
const ghostsnpMagicBytes = new TextEncoder().encode(ghostsnpMagic);
let nextSubscriptionSequence = 1;

/**
 * Optional hooks that pause ownership-creating async boundaries so isolation
 * tests can destroy or switch sessions mid-flight.
 */
export interface HubTerminalDataPlaneTestHooks {
  beforeAttachAcquire?: () => Promise<void> | void;
  beforeSnapshotInstall?: () => Promise<void> | void;
  beforeReadModeFlags?: () => Promise<void> | void;
  beforeResize?: () => Promise<void> | void;
  beforeModeGatedInput?: () => Promise<void> | void;
  beforeListenerDelivery?: () => Promise<void> | void;
}

interface ScreenHydration {
  generation: number;
  bufferedOutput: string[];
  bufferedBytes: number;
  pendingExit?: number | null;
  snapshotBytes?: Uint8Array;
  snapshotReceived: boolean;
  attachedReceived: boolean;
  completed: boolean;
}

export interface HubTerminalDataPlaneOptions {
  bridge: DaemonBridgeClient;
  sessionId?: string;
  subscriptionId?: string;
  /** Test-only pause points for request-race isolation matrix. */
  testHooks?: HubTerminalDataPlaneTestHooks;
}

export class HubTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly sessionId: string;

  private readonly subscriptionId: string;
  private readonly testHooks: HubTerminalDataPlaneTestHooks | undefined;
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
  private modeFlags: DaemonModeFlags | undefined;
  private binarySnapshotInstaller:
    | ((bytes: Uint8Array) => boolean | Promise<boolean>)
    | undefined;
  private hydratePromise: Promise<void> | undefined;

  constructor(private readonly options: HubTerminalDataPlaneOptions) {
    if (!options.sessionId) throw new Error("Hub terminal data plane requires a session id.");
    this.sessionId = options.sessionId;
    this.subscriptionId = options.subscriptionId ?? createTerminalSubscriptionId();
    this.testHooks = options.testHooks;
  }

  bindBinarySnapshotInstaller(
    installer: (bytes: Uint8Array) => boolean | Promise<boolean>
  ): void {
    this.binarySnapshotInstaller = installer;
  }

  async writeInput(data: string): Promise<void> {
    recordLiveHarnessTerminal("input", { data, path: "send_input" });
    await this.ensureAttached();
    if (this.detached) return;
    await this.options.bridge.request({
      type: "send_input",
      session_id: this.sessionId,
      data
    });
  }

  async writeModeGatedInput(semantic: ModeDependentTerminalInput): Promise<void> {
    const attachmentGeneration = this.attachmentGeneration;
    await this.ensureAttached();
    if (!this.isCurrentAttachment(attachmentGeneration)) return;

    await this.testHooks?.beforeModeGatedInput?.();
    if (!this.isCurrentAttachment(attachmentGeneration)) return;

    let modes = this.modeFlags;
    if (!modes) {
      modes = await this.refreshModeFlags(attachmentGeneration);
    }
    if (!modes || !this.isCurrentAttachment(attachmentGeneration)) {
      throw new Error("Authoritative mode flags are unavailable for mode-gated terminal input.");
    }

    // Browser JSON number cannot preserve arbitrary u64 mode generations. When Hub/worker
    // emits a non-JSON-safe token, ModeGatedInput can never match; fall back to send_input
    // rather than looping stale rejects. True race-free gating requires JSON-safe tokens
    // from the producer (core/hub follow-up).
    if (!isJsonSafeModeToken(modes)) {
      const encoded = semantic.encode(modes);
      recordLiveHarnessTerminal("mode_gated_input_fallback", {
        reason: "unsafe_json_integer_token",
        mode_generation: modes.mode_generation,
        mode_revision: modes.mode_revision,
        bytes: encoded
      });
      await this.writeInput(encoded);
      return;
    }

    // First encode under current authoritative modes.
    const encoded = semantic.encode(modes);
    const result = await this.sendModeGatedInput(encoded, modes, attachmentGeneration);
    if (!this.isCurrentAttachment(attachmentGeneration)) return;
    if (result?.admitted) {
      recordLiveHarnessTerminal("mode_gated_input", {
        admitted: true,
        bytes: encoded,
        mode_generation: modes.mode_generation,
        mode_revision: modes.mode_revision
      });
      return;
    }

    if (!isStaleModeGatedReject(result)) {
      recordLiveHarnessTerminal("mode_gated_input", {
        admitted: false,
        bytes: encoded,
        error_kind: result?.error_kind ?? null
      });
      if (result && !result.admitted) {
        throw new Error(
          result.error_kind
            ? `Mode-gated input rejected: ${result.error_kind}`
            : "Mode-gated input was not admitted."
        );
      }
      throw new Error("Mode-gated input response was missing.");
    }

    // Stale reject: refresh modes from result or ReadModeFlags, discard old bytes, re-encode once.
    const staleResult = result;
    const freshModes =
      (staleResult ? modeFlagsFromGatedResult(staleResult) : undefined) ??
      (await this.refreshModeFlags(attachmentGeneration));
    if (!freshModes || !this.isCurrentAttachment(attachmentGeneration)) return;
    this.modeFlags = freshModes;

    const reencoded = semantic.encode(freshModes);
    // Never pair stale bytes with a fresh token.
    const retryResult = await this.sendModeGatedInput(reencoded, freshModes, attachmentGeneration);
    if (!this.isCurrentAttachment(attachmentGeneration)) return;

    recordLiveHarnessTerminal("mode_gated_input", {
      admitted: Boolean(retryResult?.admitted),
      bytes: reencoded,
      reencoded: true,
      discarded_bytes: encoded,
      mode_generation: freshModes.mode_generation,
      mode_revision: freshModes.mode_revision,
      error_kind: retryResult?.error_kind ?? null
    });

    if (!retryResult?.admitted) {
      throw new Error(
        retryResult?.error_kind
          ? `Mode-gated input retry rejected: ${retryResult.error_kind}`
          : "Mode-gated input retry was not admitted."
      );
    }
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
    const attachmentGeneration = this.attachmentGeneration;
    await this.ensureAttached();
    if (!this.isCurrentAttachment(attachmentGeneration) && this.attachmentGeneration === 0) {
      // ensureAttached may have started a new generation
    }
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
    await this.testHooks?.beforeAttachAcquire?.();
    if (!this.isCurrentAttachment(attachmentGeneration) || this.listeners.size === 0) {
      return;
    }

    if (!this.options.bridge.streamTerminal) {
      throw new Error("WebRTC client does not expose terminal streaming.");
    }

    const streamSubscription = this.options.bridge.streamTerminal(
      this.sessionId,
      this.subscriptionId,
      (event) => {
        void this.emitTerminalEvent(event, attachmentGeneration);
      }
    );
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      streamSubscription.unsubscribe();
      return;
    }
    this.streamSubscription = streamSubscription;
    recordLiveHarnessTerminal("attach", { attempt: 1, generation: attachmentGeneration });
    await this.flushPendingResize();
  }

  private closeStream(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = undefined;
    this.attachPromise = undefined;
    this.hydratePromise = undefined;
    this.attachmentGeneration += 1;
    this.hydration = undefined;
    this.hydratedGeneration = undefined;
    this.restoredVisibleScreenGeneration = undefined;
    this.modeFlags = undefined;
  }

  private async flushPendingResize(): Promise<void> {
    if (!this.streamSubscription || !this.pendingResize) return;

    const attachmentGeneration = this.attachmentGeneration;
    const resize = this.pendingResize;
    this.pendingResize = undefined;

    await this.testHooks?.beforeResize?.();
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return;
    }

    await this.options.bridge.request({
      type: "resize",
      session_id: this.sessionId,
      rows: resize.rows,
      cols: resize.columns
    });
  }

  private async emitTerminalEvent(event: DaemonEvent, attachmentGeneration: number): Promise<void> {
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return;
    }

    if (!isTerminalStreamEvent(event) || event.session_id !== this.sessionId || event.subscription_id !== this.subscriptionId) {
      return;
    }

    await this.testHooks?.beforeListenerDelivery?.();
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return;
    }

    if (event.type === "attach_state") {
      this.emitStatus(attachStateStatus(event.state));
      if (event.state === "attached") {
        this.ensureHydration(attachmentGeneration).attachedReceived = true;
        this.scheduleHydration(attachmentGeneration);
      }
      recordLiveHarnessTerminal("attach_state", { state: event.state });
      return;
    }

    if (event.type === "process_exit") {
      if (this.hydration?.generation === attachmentGeneration && !this.hydration.completed) {
        this.hydration.pendingExit = event.code;
        return;
      }
      this.emitProcessExit(event.code);
      return;
    }

    if (event.type === "scrollback") {
      // Scrollback events are never imported as GHOSTSNP / Restty state.
      recordLiveHarnessTerminal("scrollback", {
        bytes: event.bytes,
        payload_encoding: event.payload_encoding,
        imported: false
      });
      return;
    }

    if (event.type === "snapshot") {
      recordLiveHarnessTerminal("snapshot", {
        bytes: event.bytes,
        payload_encoding: event.payload_encoding
      });
      const hydration = this.ensureHydration(attachmentGeneration);
      try {
        const snapshotBytes = decodeGhostsnpSnapshot(event.payload_base64, event.bytes);
        hydration.snapshotBytes = snapshotBytes;
        hydration.snapshotReceived = true;
        this.scheduleHydration(attachmentGeneration);
      } catch (error: unknown) {
        this.failHydration(
          hydration,
          error instanceof Error ? error.message : "Invalid terminal snapshot payload."
        );
      }
      return;
    }

    if (event.type === "terminal_output") {
      if (this.hydration?.generation === attachmentGeneration && !this.hydration.completed) {
        this.bufferHydratingOutput(event.data, this.hydration);
        return;
      }
      if (
        this.currentStatus.state === "attaching" ||
        (this.currentStatus.state === "attached" && this.restoredVisibleScreenGeneration !== attachmentGeneration)
      ) {
        this.emitStatus({
          state: "live_only",
          message: "Terminal stream attached live; no GHOSTSNP snapshot was restored."
        });
      }
      this.emitOutput(event.data, "output");
    }
  }

  private ensureHydration(attachmentGeneration: number): ScreenHydration {
    if (this.hydration?.generation === attachmentGeneration) {
      return this.hydration;
    }

    const hydration: ScreenHydration = {
      generation: attachmentGeneration,
      bufferedOutput: [],
      bufferedBytes: 0,
      snapshotReceived: false,
      attachedReceived: false,
      completed: false
    };
    this.hydration = hydration;
    this.hydratedGeneration = attachmentGeneration;
    return hydration;
  }

  private scheduleHydration(attachmentGeneration: number): void {
    if (this.hydratePromise) return;
    const hydration = this.hydration;
    if (!hydration || hydration.generation !== attachmentGeneration || hydration.completed) {
      return;
    }
    if (!hydration.snapshotReceived || !hydration.attachedReceived) {
      return;
    }

    const promise = this.completeGhostsnpHydration(hydration);
    this.hydratePromise = promise;
    void promise.finally(() => {
      if (this.hydratePromise === promise) {
        this.hydratePromise = undefined;
      }
    });
  }

  private async completeGhostsnpHydration(hydration: ScreenHydration): Promise<void> {
    const attachmentGeneration = hydration.generation;
    try {
      if (!hydration.snapshotBytes) {
        throw new Error("GHOSTSNP snapshot bytes missing after Snapshot event.");
      }

      await this.testHooks?.beforeSnapshotInstall?.();
      if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) {
        return;
      }

      const installer = this.binarySnapshotInstaller;
      if (!installer) {
        throw new Error("Restty binary snapshot installer is not bound for GHOSTSNP attach.");
      }

      const installed = await installer(hydration.snapshotBytes);
      if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) {
        return;
      }
      if (!installed) {
        throw new Error("Restty rejected GHOSTSNP snapshot import.");
      }
      recordLiveHarnessTerminal("ghostsnp_install", {
        bytes: hydration.snapshotBytes.byteLength,
        generation: attachmentGeneration
      });

      this.restoredVisibleScreenGeneration = attachmentGeneration;
      this.emitStatus({
        state: "attached",
        message: "Visible terminal screen restored from GHOSTSNP snapshot."
      });

      const modes = await this.refreshModeFlags(attachmentGeneration);
      if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) {
        return;
      }
      if (!modes) {
        throw new Error("ReadModeFlags failed after GHOSTSNP install.");
      }

      // Optional ReadScreen supplement only — never primary paint path.
      try {
        const response = await this.options.bridge.request({
          type: "read_screen",
          session_id: this.sessionId
        });
        if (this.isCurrentAttachment(attachmentGeneration) && this.hydration === hydration) {
          const text = response.read_screen?.text;
          recordLiveHarnessTerminal("read_screen_supplement", {
            text: typeof text === "string" ? text : null
          });
        }
      } catch {
        // Optional supplement; attach already succeeded via GHOSTSNP.
      }

      if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) {
        return;
      }

      hydration.completed = true;
      this.hydration = undefined;

      for (const data of hydration.bufferedOutput) {
        if (!this.isCurrentAttachment(attachmentGeneration)) {
          return;
        }
        this.emitOutput(data, "output");
      }
      if (hydration.pendingExit !== undefined) {
        this.emitProcessExit(hydration.pendingExit);
      }
    } catch (error: unknown) {
      if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) {
        return;
      }
      this.failHydration(
        hydration,
        error instanceof Error ? error.message : "GHOSTSNP terminal hydration failed."
      );
    }
  }

  private failHydration(hydration: ScreenHydration, message: string): void {
    if (this.hydration !== hydration) return;
    this.hydration = undefined;
    hydration.completed = true;
    this.emitStatus({
      state: "failed",
      message
    });
    recordLiveHarnessTerminal("ghostsnp_hydrate_failed", { message });
    this.closeStream();
  }

  private bufferHydratingOutput(data: string, hydration: ScreenHydration): void {
    const bufferedBytes = hydration.bufferedBytes + new TextEncoder().encode(data).byteLength;
    if (bufferedBytes > maxHydrationBufferBytes) {
      this.failHydration(hydration, "Terminal GHOSTSNP hydration exceeded the live-output buffer limit.");
      return;
    }

    hydration.bufferedOutput.push(data);
    hydration.bufferedBytes = bufferedBytes;
  }

  private async refreshModeFlags(attachmentGeneration: number): Promise<DaemonModeFlags | undefined> {
    await this.testHooks?.beforeReadModeFlags?.();
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      recordLiveHarnessTerminal("mode_flags_skipped", {
        reason: "stale_attachment_before_request",
        generation: attachmentGeneration
      });
      return undefined;
    }

    let response;
    try {
      response = await this.options.bridge.request({
        type: "read_mode_flags",
        session_id: this.sessionId
      });
    } catch (error: unknown) {
      recordLiveHarnessTerminal("mode_flags_failed", {
        reason: "request_threw",
        message: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }

    if (!this.isCurrentAttachment(attachmentGeneration)) {
      recordLiveHarnessTerminal("mode_flags_skipped", {
        reason: "stale_attachment_after_response",
        generation: attachmentGeneration
      });
      return undefined;
    }

    const modeFlags = response.mode_flags ?? undefined;
    if (!modeFlags) {
      recordLiveHarnessTerminal("mode_flags_failed", {
        reason: "missing_mode_flags",
        response_kind: response.kind,
        error: response.error ?? null
      });
      return undefined;
    }
    if (modeFlags.session_id !== this.sessionId) {
      recordLiveHarnessTerminal("mode_flags_failed", {
        reason: "session_mismatch",
        expected: this.sessionId,
        actual: modeFlags.session_id
      });
      return undefined;
    }
    this.modeFlags = modeFlags;
    recordLiveHarnessTerminal("mode_flags", {
      mode_generation: modeFlags.mode_generation,
      mode_revision: modeFlags.mode_revision,
      kitty_enabled: modeFlags.kitty_enabled,
      mouse_mode: modeFlags.mouse_mode
    });
    return modeFlags;
  }

  private async sendModeGatedInput(
    data: string,
    modes: DaemonModeFlags,
    attachmentGeneration: number
  ): Promise<DaemonModeGatedInputResult | undefined> {
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return undefined;
    }
    const response = await this.options.bridge.request({
      type: "mode_gated_input",
      session_id: this.sessionId,
      data,
      mode_generation: modes.mode_generation,
      mode_revision: modes.mode_revision
    });
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return undefined;
    }
    return response.mode_gated_input ?? undefined;
  }

  private emitOutput(data: TerminalOutput, kind: "output" | "ghostsnp"): void {
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

export function isGhostsnpPayload(bytes: Uint8Array): boolean {
  if (bytes.byteLength < ghostsnpMagicBytes.byteLength) return false;
  for (let i = 0; i < ghostsnpMagicBytes.byteLength; i += 1) {
    if (bytes[i] !== ghostsnpMagicBytes[i]) return false;
  }
  return true;
}

export function decodeGhostsnpSnapshot(payloadBase64: string, declaredBytes?: number): Uint8Array {
  const bytes = base64ToBytes(payloadBase64);
  if (typeof declaredBytes === "number" && declaredBytes !== bytes.byteLength) {
    throw new Error(
      `Snapshot payload length ${bytes.byteLength} does not match declared bytes ${declaredBytes}.`
    );
  }
  if (!isGhostsnpPayload(bytes)) {
    throw new Error("Snapshot payload is not GHOSTSNP; refusing non-Ghostty import.");
  }
  return bytes;
}

function base64ToBytes(payloadBase64: string): Uint8Array {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(payloadBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const buffer = (globalThis as { Buffer?: { from(data: string, encoding: string): Uint8Array } }).Buffer;
  if (buffer) {
    return new Uint8Array(buffer.from(payloadBase64, "base64"));
  }

  throw new Error("No base64 decoder is available in this runtime.");
}

function isJsonSafeModeToken(modes: DaemonModeFlags): boolean {
  return Number.isSafeInteger(modes.mode_generation) && Number.isSafeInteger(modes.mode_revision);
}

function isStaleModeGatedReject(result: DaemonModeGatedInputResult | undefined): boolean {
  if (!result || result.admitted) return false;
  if (result.bytes_written !== 0) return false;
  // Worker stale token reject: admitted=false, error_kind omitted, fresh modes present.
  if (result.error_kind == null || result.error_kind === "stale" || result.error_kind === "stale_mode") {
    return typeof result.mode_generation === "number" && typeof result.mode_revision === "number";
  }
  return false;
}

function modeFlagsFromGatedResult(result: DaemonModeGatedInputResult): DaemonModeFlags | undefined {
  if (!result.session_id) return undefined;
  return {
    session_id: result.session_id,
    kitty_enabled: result.kitty_enabled,
    cursor_visible: result.cursor_visible,
    bracketed_paste: result.bracketed_paste,
    mouse_mode: result.mouse_mode,
    alt_screen: result.alt_screen,
    focus_reporting: result.focus_reporting,
    application_cursor: result.application_cursor,
    mode_generation: result.mode_generation,
    mode_revision: result.mode_revision
  };
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
      message: "Terminal stream attached; waiting for GHOSTSNP snapshot."
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
