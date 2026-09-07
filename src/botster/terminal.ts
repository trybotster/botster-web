import type { DaemonReadScreen } from "./realHubDaemonDto";
import type { TerminalSemanticInput } from "./terminalInputEvents";

export interface TerminalViewDescriptor {
  sessionId: string;
  renderer: "restty";
}

export interface TerminalViewMount {
  sessionId: string;
  mountId: number;
}

export type TerminalOutput = Uint8Array;
export type TerminalSnapshotProgress = "ready" | "page" | "finish";

export interface TerminalSnapshotReader {
  read(bytes: Uint8Array): TerminalSnapshotProgress | Promise<TerminalSnapshotProgress>;
  cancel(): void;
}

export interface TerminalSubscription {
  unsubscribe(): void;
}

export interface TerminalAttachmentStatus {
  state: "attaching" | "attached" | "exited" | "failed";
  message: string;
}

/** Authoritative terminal modes and grid from the latest Core MODES frame. */
export interface TerminalModes {
  modeBits: number;
  rows: number;
  cols: number;
}

export type TerminalInputOperationKind = "raw" | "key" | "mouse" | "focus" | "resize" | "paste";

/**
 * Outcome names for one terminal input operation. The Core names are the snake_case
 * `InputOutcome` values reported in INPUT_RESULT. `rejected_locally` is Web's own refusal
 * before any frame was sent; its `reason` names the local bound or condition.
 */
export type TerminalInputOutcomeName =
  | "written"
  | "partial_write"
  | "write_failed"
  | "cancelled"
  | "rejected_not_writable"
  | "rejected_too_large"
  | "rejected_unsafe_paste"
  | "rejected_lane_full"
  | "rejected_protocol"
  | "session_ended"
  | "outcome_unknown"
  | "rejected_locally";

/**
 * Outcome of one explicit terminal input operation.
 *
 * `requestedBytes` is the client payload size Web sent (for paste, the UTF-8 size).
 * `acceptedPayloadBytes` is the client payload the worker admitted. `writtenPtyBytes` is
 * Core's authoritative count of bytes written to the PTY including encoder-added bytes such
 * as bracketed-paste markers, so it is never presented as "N of M" against the clipboard
 * size. Unknown counts are absent, never zero.
 */
export interface TerminalInputOutcome {
  kind: TerminalInputOperationKind;
  outcome: TerminalInputOutcomeName;
  operationId?: number;
  requestedBytes?: number;
  acceptedPayloadBytes?: number;
  writtenPtyBytes?: number;
  reason?: string;
  /** Exact rejected operation that can authorize one confirmed unsafe paste. */
  unsafePasteConsent?: UnsafePasteConsent;
  detail: string;
}

export interface UnsafePasteConsent {
  readonly attachmentGeneration: number;
  readonly rejectedOperationId: number;
  readonly expiresAt: number;
}

export interface TerminalResizeGeometry {
  rows: number;
  cols: number;
  widthPx: number;
  heightPx: number;
}

export interface TerminalDataPlaneAttachment {
  sessionId: string;
  /**
   * Queue one semantic input operation in order. The plane assigns the operation id,
   * encodes the Core input frame, bounds the in-flight window, and reports the outcome
   * through `subscribeInputOutcomes`. Never waits on an acknowledgement.
   */
  sendInput(input: TerminalSemanticInput): void;
  /**
   * Explicit clipboard paste as one Core operation (PASTE_BEGIN, chunks, PASTE_COMMIT).
   * Resolves with the authoritative outcome. Web never adds bracketed-paste markers.
   */
  writePaste(text: string): Promise<TerminalInputOutcome>;
  /** Queue one confirmed unsafe paste only when the exact consent is still current. */
  confirmUnsafePaste?(consent: UnsafePasteConsent): boolean;
  /** Release one pending unsafe paste only when the exact consent is still current. */
  cancelUnsafePaste?(consent: UnsafePasteConsent): boolean;
  /** Bind the Restty incremental snapshot decoder for one subscription. */
  bindIncrementalSnapshotReader?(createReader: () => TerminalSnapshotReader): void;
  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription;
  subscribeStatus?(listener: (status: TerminalAttachmentStatus) => void): TerminalSubscription;
  subscribeModes?(listener: (modes: TerminalModes) => void): TerminalSubscription;
  subscribeInputOutcomes?(listener: (outcome: TerminalInputOutcome) => void): TerminalSubscription;
  resize?(geometry: TerminalResizeGeometry): void;
  readScreen?(): Promise<DaemonReadScreen | undefined>;
  /** Paged host-control readback assembled into one GHOSTSNP buffer; low-rate control only. */
  captureSnapshot?(): Promise<Uint8Array | undefined>;
  detach?(): void | Promise<void>;
}

export interface TerminalRendererAdapter {
  mount(container: HTMLElement): void | Promise<void>;
  attachDataPlane?(dataPlane: TerminalDataPlaneAttachment): TerminalSubscription | void | Promise<TerminalSubscription | void>;
  /** Generic renderers without a data-plane attachment report typed input here. */
  onInput?(listener: (input: TerminalSemanticInput) => void): TerminalSubscription;
  /** Outcomes of explicit input operations the renderer routed. */
  onInputOutcome?(listener: (outcome: TerminalInputOutcome) => void): TerminalSubscription;
  write(data: TerminalOutput): void | Promise<void>;
  resize(rows: number, columns: number): void | Promise<void>;
  focus(): void | Promise<void>;
  destroy(): void | Promise<void>;
}

export type TerminalRendererFactory = (
  descriptor: TerminalViewDescriptor
) => TerminalRendererAdapter;

export interface TerminalViewBridge {
  attach(
    descriptor: TerminalViewDescriptor,
    dataPlane: TerminalDataPlaneAttachment
  ): Promise<void>;
  detach(descriptor: TerminalViewDescriptor): Promise<void>;
  mount(container: HTMLElement, descriptor: TerminalViewDescriptor): Promise<TerminalViewMount>;
  unmount(descriptor: TerminalViewDescriptor, mount?: TerminalViewMount): Promise<void>;
  resize(descriptor: TerminalViewDescriptor, rows: number, columns: number): Promise<void>;
  focus(descriptor: TerminalViewDescriptor): Promise<void>;
  /** Explicit raw bytes for harness and diagnostics paths only. */
  writeRawInput(descriptor: TerminalViewDescriptor, data: string): Promise<void>;
  /** Subscribe to explicit input outcomes for the mounted session. */
  subscribeInputOutcomes?(
    descriptor: TerminalViewDescriptor,
    listener: (outcome: TerminalInputOutcome) => void
  ): TerminalSubscription;
}

interface TerminalMountState {
  descriptor: TerminalViewDescriptor;
  mountId: number;
  renderer: TerminalRendererAdapter;
  container: HTMLElement;
  dataPlane?: TerminalDataPlaneAttachment;
  rendererDataPlaneSubscription?: TerminalSubscription;
  inputSubscription?: TerminalSubscription;
  outputSubscription?: TerminalSubscription;
  focusing?: boolean;
}

export class DefaultTerminalViewBridge implements TerminalViewBridge {
  private readonly mounts = new Map<string, TerminalMountState>();
  private readonly mountOperations = new Map<string, Promise<unknown>>();
  private nextMountId = 1;

  constructor(private readonly createRenderer: TerminalRendererFactory) {}

  async mount(
    container: HTMLElement,
    descriptor: TerminalViewDescriptor
  ): Promise<TerminalViewMount> {
    const sessionId = descriptor.sessionId;
    const mountId = this.nextMountId;
    this.nextMountId += 1;
    const previousOperation = this.mountOperations.get(sessionId) ?? Promise.resolve();
    const operation = previousOperation.then(async () => {
      await this.unmount(descriptor);

      const renderer = this.createRenderer(descriptor);
      await renderer.mount(container);
      const mount: TerminalViewMount = { sessionId, mountId };
      this.mounts.set(sessionId, { descriptor, mountId, renderer, container });
      return mount;
    });

    const trackedOperation: Promise<unknown> = operation
      .catch(() => undefined)
      .finally(() => {
        if (this.mountOperations.get(sessionId) === trackedOperation) {
          this.mountOperations.delete(sessionId);
        }
      });
    this.mountOperations.set(sessionId, trackedOperation);

    return operation;
  }

  async attach(
    descriptor: TerminalViewDescriptor,
    dataPlane: TerminalDataPlaneAttachment
  ): Promise<void> {
    const state = this.requireMount(descriptor);
    if (
      state.dataPlane === dataPlane &&
      (state.rendererDataPlaneSubscription || (state.inputSubscription && state.outputSubscription))
    ) {
      return;
    }

    await this.detach(descriptor);
    state.dataPlane = dataPlane;

    if (state.renderer.attachDataPlane) {
      const subscription = await state.renderer.attachDataPlane(dataPlane);
      if (subscription) {
        state.rendererDataPlaneSubscription = subscription;
      }
      return;
    }

    state.inputSubscription = state.renderer.onInput?.((input) => {
      dataPlane.sendInput(input);
    });
    const observeRender = createRendererWriteObserver(descriptor.sessionId);
    state.outputSubscription = dataPlane.subscribeOutput((data) => {
      const rendered = state.renderer.write(data);
      if (observeRender) {
        void Promise.resolve(rendered).then(() => observeRender(data));
      }
    });
  }

  async detach(descriptor: TerminalViewDescriptor): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return;

    state.inputSubscription?.unsubscribe();
    state.inputSubscription = undefined;

    try {
      if (state.dataPlane?.detach) {
        await state.dataPlane.detach();
      }
    } finally {
      state.dataPlane = undefined;
      state.outputSubscription?.unsubscribe();
      state.rendererDataPlaneSubscription?.unsubscribe();
      state.outputSubscription = undefined;
      state.rendererDataPlaneSubscription = undefined;
    }
  }

  async unmount(descriptor: TerminalViewDescriptor, mount?: TerminalViewMount): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return;
    if (mount && (mount.sessionId !== descriptor.sessionId || mount.mountId !== state.mountId)) {
      return;
    }

    let detachError: unknown;
    let destroyError: unknown;
    try {
      await this.detach(descriptor);
    } catch (error) {
      detachError = error;
    } finally {
      try {
        await state.renderer.destroy();
      } catch (error) {
        destroyError = error;
      } finally {
        this.mounts.delete(descriptor.sessionId);
      }
    }
    if (detachError !== undefined) {
      throw detachError;
    }
    if (destroyError !== undefined) {
      throw destroyError;
    }
  }

  async resize(
    descriptor: TerminalViewDescriptor,
    rows: number,
    columns: number
  ): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return;

    await state.renderer.resize(rows, columns);
    if (!state.renderer.attachDataPlane && state.dataPlane?.resize) {
      state.dataPlane.resize({ rows, cols: columns, widthPx: 0, heightPx: 0 });
    }
  }

  async focus(descriptor: TerminalViewDescriptor): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state || state.focusing) return;

    state.focusing = true;
    try {
      await state.renderer.focus();
    } finally {
      state.focusing = false;
    }
  }

  async writeRawInput(descriptor: TerminalViewDescriptor, data: string): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state?.dataPlane) return;
    state.dataPlane.sendInput({ kind: "raw", bytes: new TextEncoder().encode(data) });
  }

  subscribeInputOutcomes(
    descriptor: TerminalViewDescriptor,
    listener: (outcome: TerminalInputOutcome) => void
  ): TerminalSubscription {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return { unsubscribe() {} };
    const rendererSubscription = state.renderer.onInputOutcome?.(listener);
    const planeSubscription = state.dataPlane?.subscribeInputOutcomes?.(listener);
    return {
      unsubscribe() {
        rendererSubscription?.unsubscribe();
        planeSubscription?.unsubscribe();
      }
    };
  }

  private requireMount(descriptor: TerminalViewDescriptor): TerminalMountState {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) {
      throw new Error(`terminal_view is not mounted for session ${descriptor.sessionId}`);
    }
    return state;
  }
}

export class MockTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly inputs: TerminalSemanticInput[] = [];
  readonly resizes: TerminalResizeGeometry[] = [];
  readonly pastes: string[] = [];
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private readonly statusListeners = new Set<(status: TerminalAttachmentStatus) => void>();
  private detached = false;
  detachCount = 0;
  outputSubscriptionCount = 0;
  outputUnsubscribeCount = 0;

  constructor(
    readonly sessionId: string,
    private readonly initialOutput: TerminalOutput[] = []
  ) {}

  sendInput(input: TerminalSemanticInput): void {
    if (!this.detached) {
      this.inputs.push(input);
    }
  }

  async writePaste(text: string): Promise<TerminalInputOutcome> {
    if (this.detached) {
      return {
        kind: "paste",
        outcome: "rejected_locally",
        requestedBytes: text.length,
        reason: "detached",
        detail: "Mock terminal data plane is detached."
      };
    }
    this.pastes.push(text);
    const bytes = new TextEncoder().encode(text).byteLength;
    return {
      kind: "paste",
      outcome: "written",
      operationId: this.pastes.length,
      requestedBytes: bytes,
      acceptedPayloadBytes: bytes,
      writtenPtyBytes: bytes,
      detail: "Mock paste recorded."
    };
  }

  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription {
    this.listeners.add(listener);
    this.outputSubscriptionCount += 1;
    this.initialOutput.forEach((line) => listener(line));

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
        this.outputUnsubscribeCount += 1;
      }
    };
  }

  subscribeStatus(listener: (status: TerminalAttachmentStatus) => void): TerminalSubscription {
    this.statusListeners.add(listener);
    listener({
      state: "attached",
      message: "Mock terminal data plane attached."
    });

    return {
      unsubscribe: () => {
        this.statusListeners.delete(listener);
      }
    };
  }

  emitOutput(data: TerminalOutput): void {
    if (!this.detached) {
      this.listeners.forEach((listener) => listener(data));
    }
  }

  resize(geometry: TerminalResizeGeometry): void {
    if (!this.detached) {
      this.resizes.push(geometry);
    }
  }

  detach(): void {
    this.detachCount += 1;
    this.detached = true;
    this.listeners.clear();
    this.statusListeners.clear();
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    for (const value of bytes) {
      binary += String.fromCharCode(value);
    }
    return globalThis.btoa(binary);
  }

  const buffer = (globalThis as { Buffer?: { from(data: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (buffer) {
    return buffer.from(bytes).toString("base64");
  }

  throw new Error("No base64 encoder is available in this runtime.");
}

/**
 * Install payload collection only when an operator harness has explicitly created its
 * terminal recorder before mount. Production mounts have no recorder and no observer.
 */
export function createRendererWriteObserver(sessionId: string): ((data: TerminalOutput) => void) | undefined {
  const runtime = globalThis as typeof globalThis & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      terminal?: Array<{ kind: string; payload: unknown }>;
      suppressRendererWriteTelemetry?: boolean;
    };
  };
  const harness = runtime.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  if (!harness?.terminal) return undefined;

  return (data) => {
    if (runtime.__BOTSTER_LIVE_PROTOCOL_HARNESS__ !== harness || !harness.terminal || harness.suppressRendererWriteTelemetry) return;
    harness.terminal.push({
      kind: "renderer_write",
      payload: {
        payload_bytes_base64: bytesToBase64(data),
        bytes: data.byteLength,
        sessionId
      }
    });
  };
}
