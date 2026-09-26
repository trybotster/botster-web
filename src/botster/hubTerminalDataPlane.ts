import type {
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalInputOutcome,
  TerminalInputOutcomeName,
  TerminalModes,
  TerminalOutput,
  TerminalResizeGeometry,
  TerminalSnapshotReader,
  TerminalSubscription,
  UnsafePasteConsent
} from "./terminal";
import type { TerminalSemanticInput } from "./terminalInputEvents";
import type {
  DaemonBridgeClient,
  DaemonTerminalStreamSubscription,
  TerminalRouteFrame,
  TerminalStreamEvent
} from "./hubTransport";
import { hubTerminalSubscriptionId } from "./hubTransport";
import type { DaemonReadScreen } from "./realHubDaemonDto";
import {
  localWebrtcResponseChunkLimits,
  type WebrtcDaemonLifecycleEvent
} from "./webrtcDaemonClient";
import {
  decodeTerminalBody,
  MAX_INPUT_OPERATIONS_PER_SESSION,
  MAX_PASTE_BYTES,
  MAX_RETAINED_INPUT_BYTES_PER_SESSION,
  type AttachStateCodeName,
  type HistoryUnavailableReasonName,
  type InputResultBody,
  type TerminalEvent
} from "./generated/terminal-protocol";
import {
  encodePasteOperation,
  encodeSemanticInput,
  type EncodedInputOperation
} from "./terminalInputEncoding";

let nextSubscriptionSequence = 1;

/**
 * Bound for the awaited public Detach request. Matches production WebRTC
 * `requestTimeoutMs` so unmount cannot hang on a never-resolving bridge.
 */
export const DETACH_REQUEST_BOUND_MS = localWebrtcResponseChunkLimits.requestTimeoutMs;

/**
 * Client loop bounds from the implementation contract. Pending terminal frames are the
 * live OUTPUT bytes held while snapshot history installs; overflow detaches and re-attaches
 * this route only. Input operations wait locally up to the retained-byte bound once 32 are
 * in flight; beyond that the operation is refused to the user.
 */
export const MAX_PENDING_TERMINAL_ITEMS = 256;
export const MAX_PENDING_TERMINAL_BYTES = 8 * 1024 * 1024;
export const MAX_INFLIGHT_INPUT_OPERATIONS: number = MAX_INPUT_OPERATIONS_PER_SESSION;
export const MAX_QUEUED_INPUT_BYTES: number = MAX_RETAINED_INPUT_BYTES_PER_SESSION;
/** Web-local bound on unsent input operations, matching the pending output item bound. */
export const MAX_QUEUED_INPUT_OPERATIONS: number = MAX_PENDING_TERMINAL_ITEMS;
export const UNSAFE_PASTE_CONSENT_TIMEOUT_MS = 30_000;

/**
 * Optional hooks that pause ownership-creating async boundaries so isolation
 * tests can destroy or switch sessions mid-flight. Injected by construction only.
 */
export interface HubTerminalDataPlaneTestHooks {
  beforeAttachAcquire?: () => Promise<void> | void;
  beforeSnapshotInstall?: () => Promise<void> | void;
  beforeInputSend?: () => Promise<void> | void;
  beforeListenerDelivery?: () => Promise<void> | void;
  /** Test-only shorter race for the public Detach hang bound. */
  detachRequestBoundMs?: number;
  /** Test-only shorter bound for admitted terminal hydration progress. */
  hydrationProgressBoundMs?: number;
  /** Test-only shorter bound for unsafe-paste consent. */
  unsafePasteConsentTimeoutMs?: number;
}

export interface HubTerminalDataPlaneOptions {
  bridge: DaemonBridgeClient;
  sessionId?: string;
  subscriptionId?: string;
  testHooks?: HubTerminalDataPlaneTestHooks;
}

interface ScreenHydration {
  generation: number;
  bufferedOutput: Uint8Array[];
  bufferedBytes: number;
  pendingExit?: number | null;
  readyReceived: boolean;
  /** The renderer's history decoder reported its GHOSTSNP finish record. */
  decoderFinished: boolean;
  finishReceived: boolean;
  historyIncomplete: boolean;
  completed: boolean;
  progressTimeout?: ReturnType<typeof setTimeout>;
  reader?: TerminalSnapshotReader;
}

interface QueuedInputOperation {
  operation: EncodedInputOperation;
  kind: TerminalInputOutcome["kind"];
  requestedBytes: number;
  /** Original paste bytes retained only until the authoritative outcome is known. */
  pasteData?: Uint8Array;
  pasteAttempt?: number;
  resolve?: (outcome: TerminalInputOutcome) => void;
}

interface InflightInputOperation extends QueuedInputOperation {
  generation: number;
  operationId: number;
  /** Client payload bytes still counted against the retained-input bound until the result lands. */
  retainedBytes: number;
}

interface PendingUnsafePaste {
  consent: UnsafePasteConsent;
  data: Uint8Array;
  timeout: ReturnType<typeof setTimeout>;
}

function sameGeometry(left: TerminalResizeGeometry, right: TerminalResizeGeometry | undefined): boolean {
  return (
    right !== undefined &&
    left.rows === right.rows &&
    left.cols === right.cols &&
    left.widthPx === right.widthPx &&
    left.heightPx === right.heightPx
  );
}

export class HubTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly sessionId: string;

  private subscriptionId: string;
  private readonly fixedSubscriptionId: boolean;
  private readonly testHooks: HubTerminalDataPlaneTestHooks | undefined;
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private readonly statusListeners = new Set<(status: TerminalAttachmentStatus) => void>();
  private readonly modesListeners = new Set<(modes: TerminalModes) => void>();
  private readonly outcomeListeners = new Set<(outcome: TerminalInputOutcome) => void>();
  private currentStatus: TerminalAttachmentStatus = {
    state: "attaching",
    message: "Attaching terminal stream."
  };
  private currentModes: TerminalModes | undefined;
  private streamSubscription: DaemonTerminalStreamSubscription | undefined;
  private attachPromise: Promise<void> | undefined;
  private detached = false;
  private transportLost = false;
  private attachmentGeneration = 0;
  private attachedReceived = false;
  /** Fixed route generation of this attachment, from the terminal reservation. */
  private routeGeneration: number | undefined;
  /**
   * Accepted stream epoch: 0 once ATTACH_STATE attached arrives, then only the to_epoch of
   * a ROUTE_RESYNC whose from_epoch equals the accepted epoch. Never assigned from a data frame.
   */
  private acceptedEpoch: number | undefined;
  private detachSentFor: { subscriptionId: string; generation: number } | undefined;
  /**
   * The one attachment superseded by the current transport loss: its id, generation, and
   * whether its Attach actually left the control channel. Only a sent Attach owes a Detach.
   */
  private lastAbandonedDetach: { subscriptionId: string; generation: number; attachSent: boolean } | undefined;
  private lifecycleSubscription: { unsubscribe(): void } | undefined;
  private hydration: ScreenHydration | undefined;
  private incrementalSnapshotReaderFactory: (() => TerminalSnapshotReader) | undefined;
  private terminalEventQueue: Promise<void> = Promise.resolve();
  private snapshotRecoveries = 0;

  /** Input operation ids start at 1 after each attach and increase within the generation. */
  private nextOperationId = 1;
  private readonly queuedInputs: QueuedInputOperation[] = [];
  private queuedInputBytes = 0;
  /** Payload bytes of operations sent but not yet resulted; Core retains them until then. */
  private inflightInputBytes = 0;
  private readonly inflightInputs = new Map<number, InflightInputOperation>();
  private inputSendChain: Promise<void> = Promise.resolve();
  /** The latest local geometry; every resize() overwrites it. It survives a re-attach. */
  private desiredGeometry: TerminalResizeGeometry | undefined;
  /** The last geometry written to this attachment's route; reset with the attachment. */
  private sentGeometry: TerminalResizeGeometry | undefined;
  /** The one RESIZE operation appended to the send chain or in flight. */
  private geometryOperation: InflightInputOperation | undefined;
  private pasteAttempt = 0;
  private pendingUnsafePaste: PendingUnsafePaste | undefined;
  private consentRetainedBytes = 0;

  constructor(private readonly options: HubTerminalDataPlaneOptions) {
    if (!options.sessionId) throw new Error("Hub terminal data plane requires a session id.");
    this.sessionId = options.sessionId;
    this.fixedSubscriptionId = Boolean(options.subscriptionId);
    this.subscriptionId = options.subscriptionId ?? createTerminalSubscriptionId();
    this.testHooks = options.testHooks;
    // The operator harness decodes route bodies it receives through the transport control.
    const harness = liveHarness();
    if (harness) harness.decodeTerminalBody ??= decodeTerminalBody;
    // Surviving-document DataChannel recovery mints a fresh terminal subscription and
    // re-runs the attach ordering without unmounting the renderer. Wait for
    // encrypted-stream-ready so attach RPCs are not issued against a half-open peer.
    // Only this plane's own transport may drive that: the subscription is taken directly
    // from the bridge, and a bridge without one drives no loss or recovery at all.
    if (!options.bridge.subscribeLifecycle) {
      // A bridge that streams terminals without lifecycle delivery would never recover a
      // lost transport; refuse it here rather than degrade silently.
      throw new Error("Terminal data plane bridge must provide subscribeLifecycle.");
    }
    this.lifecycleSubscription = options.bridge.subscribeLifecycle((event) => this.handleLifecycleEvent(event));
  }

  private handleLifecycleEvent(event: WebrtcDaemonLifecycleEvent): void {
    if (this.detached) return;
    if (event.type === "data-channel-closed" || event.type === "data-channel-error") {
      this.handleTransportLost();
    } else if (
      event.type === "terminal-data-channel-closed" &&
      event.sessionId === this.sessionId &&
      event.subscriptionId === this.subscriptionId
    ) {
      // With the control transport already lost, this route close is part of the same
      // loss; the transport's own recovery re-attaches.
      if (this.transportLost) return;
      this.handleTransportLost();
      queueMicrotask(() => this.handleTransportRecovered());
    } else if (event.type === "encrypted-stream-ready") {
      this.handleTransportRecovered();
    }
  }

  bindIncrementalSnapshotReader(createReader: () => TerminalSnapshotReader): void {
    this.incrementalSnapshotReaderFactory = createReader;
  }

  // ---------------------------------------------------------------------------
  // Input: bounded in-flight window, in order, no acknowledgement serialization.
  // ---------------------------------------------------------------------------

  sendInput(input: TerminalSemanticInput): void {
    if (this.detached) return;
    if (input.kind === "resize") {
      this.resize({ rows: input.rows, cols: input.cols, widthPx: input.widthPx, heightPx: input.heightPx });
      return;
    }
    if (input.kind === "paste") {
      void this.writePaste(input.text);
      return;
    }
    const encoded = encodeSemanticInput(input);
    if (!encoded) return;
    const requestedBytes = input.kind === "raw" ? input.bytes.byteLength : encoded.bodyBytes;
    if (!this.enqueueInput({ operation: encoded, kind: input.kind, requestedBytes })) {
      this.publishOutcome({
        kind: input.kind,
        outcome: "rejected_locally",
        requestedBytes,
        reason: "queue_bounds",
        detail: this.queueBoundsDetail("Input")
      });
    }
  }

  resize(geometry: TerminalResizeGeometry): void {
    if (this.detached) return;
    recordLiveHarnessTerminal("resize", geometry);
    // Latest wins: maybeSendGeometry sends it when the route can take a RESIZE.
    this.desiredGeometry = { ...geometry };
    void this.ensureAttached().catch(() => undefined);
    this.pumpInputs();
  }

  /**
   * Explicit clipboard paste as one Core operation: PASTE_BEGIN, chunks, PASTE_COMMIT under
   * one operation id. The paste takes its place in the single ordered input queue at once,
   * so it holds queue capacity from admission, keeps its order against later keys, and is
   * cancelled with the rest of the queue when the attachment is lost. The frames of one
   * paste are sent contiguously, so Core never sees two pastes assembling on one route.
   * Web never adds bracketed-paste markers and never retries a paste.
   */
  async writePaste(text: string): Promise<TerminalInputOutcome> {
    const outcome = await this.writePasteOperation(text);
    this.publishPasteOutcome(outcome);
    return outcome;
  }

  private async writePasteOperation(text: string): Promise<TerminalInputOutcome> {
    this.releaseUnsafePasteConsent();
    this.pasteAttempt += 1;
    const pasteAttempt = this.pasteAttempt;
    const rejected = (reason: string, detail: string, requestedBytes?: number): TerminalInputOutcome => ({
      kind: "paste",
      outcome: "rejected_locally",
      ...(requestedBytes !== undefined ? { requestedBytes } : {}),
      reason,
      detail
    });
    // Every check that does not need the UTF-8 size runs before the single encoding, so an
    // oversized or refused clipboard string is never allocated as bytes.
    if (text.length === 0) return rejected("empty", "Clipboard paste was empty.");
    if (this.detached) return rejected("detached", "Terminal is detached; paste was not delivered.");
    // UTF-16 units never exceed UTF-8 bytes: reject before encoding an oversized string.
    if (text.length > MAX_PASTE_BYTES) {
      return rejected("too_large", `Paste of at least ${text.length} bytes exceeds the ${MAX_PASTE_BYTES}-byte paste limit.`);
    }
    const data = new TextEncoder().encode(text);
    const bytes = data.byteLength;
    if (bytes > MAX_PASTE_BYTES) {
      return rejected("too_large", `Paste of ${bytes} bytes exceeds the ${MAX_PASTE_BYTES}-byte paste limit.`, bytes);
    }
    const operation = encodePasteOperation(data, false);
    return new Promise<TerminalInputOutcome>((resolve) => {
      if (!this.enqueueInput({ operation, kind: "paste", requestedBytes: bytes, pasteData: data, pasteAttempt, resolve })) {
        resolve(rejected("queue_bounds", this.queueBoundsDetail("Paste"), bytes));
        return;
      }
      recordLiveHarnessTerminal("paste", { bytes, path: "subscription_data_channel" });
    });
  }

  private queueBoundsDetail(subject: string): string {
    return `${subject} refused: ${this.inflightInputs.size} operations are in flight, ${this.queuedInputs.length} are queued, and ${this.retainedInputBytes()} bytes are retained against the ${MAX_QUEUED_INPUT_OPERATIONS}-operation and ${MAX_QUEUED_INPUT_BYTES}-byte bounds.`;
  }

  /** Queued plus in-flight client payload bytes, mirroring Core's per-session retained bound. */
  private retainedInputBytes(): number {
    return this.queuedInputBytes + this.inflightInputBytes + this.consentRetainedBytes;
  }

  confirmUnsafePaste(consent: UnsafePasteConsent): boolean {
    const pending = this.pendingUnsafePaste;
    if (!pending || !sameUnsafePasteConsent(pending.consent, consent)) return false;
    if (!this.isCurrentAttachment(consent.attachmentGeneration) || Date.now() >= consent.expiresAt) {
      this.releaseUnsafePasteConsent();
      return false;
    }

    const data = pending.data;
    const requestedBytes = data.byteLength;
    this.releaseUnsafePasteConsent();
    const admitted = this.enqueueInput({
      operation: encodePasteOperation(data, true),
      kind: "paste",
      requestedBytes,
      resolve: (outcome) => this.publishPasteOutcome(outcome)
    });
    if (!admitted) {
      this.publishPasteOutcome({
        kind: "paste",
        outcome: "rejected_locally",
        requestedBytes,
        reason: "queue_bounds",
        detail: this.queueBoundsDetail("Paste")
      });
    }
    return admitted;
  }

  cancelUnsafePaste(consent: UnsafePasteConsent): boolean {
    if (!this.pendingUnsafePaste || !sameUnsafePasteConsent(this.pendingUnsafePaste.consent, consent)) {
      return false;
    }
    this.releaseUnsafePasteConsent();
    return true;
  }

  private publishPasteOutcome(outcome: TerminalInputOutcome): void {
    recordLiveHarnessTerminal("paste_outcome", { ...outcome, sessionId: this.sessionId });
    this.publishOutcome(outcome);
  }

  /** Reserves queue capacity for one operation, or refuses it without retaining anything. */
  private enqueueInput(entry: QueuedInputOperation): boolean {
    const bytes = entry.operation.bodyBytes;
    if (this.queuedInputs.length >= MAX_QUEUED_INPUT_OPERATIONS || this.retainedInputBytes() + bytes > MAX_QUEUED_INPUT_BYTES) {
      return false;
    }
    this.queuedInputs.push(entry);
    this.queuedInputBytes += bytes;
    void this.ensureAttached().catch(() => undefined);
    this.pumpInputs();
    return true;
  }

  /**
   * True after SNAPSHOT_FINISH completes the hydration of this attachment. Between
   * ATTACH_STATE attached and SNAPSHOT_FINISH, and again during a ROUTE_RESYNC hydration,
   * it is false.
   */
  private screenHydrated(): boolean {
    const hydration = this.hydration;
    return hydration?.generation === this.attachmentGeneration && hydration.completed;
  }

  /**
   * Appends the one RESIZE operation when the route can take it: attached, hydrated, window
   * capacity free, no RESIZE already appended or in flight, and the latest local geometry
   * differs from the last one sent. The operation reads the geometry again when it is sent.
   * Every event that can change one of these conditions reaches this through pumpInputs.
   */
  private maybeSendGeometry(): void {
    const stream = this.streamSubscription;
    const geometry = this.desiredGeometry;
    if (!stream?.sendFrame || !this.attachedReceived || this.detached) return;
    if (!geometry || this.geometryOperation || !this.screenHydrated()) return;
    if (this.inflightInputs.size >= MAX_INFLIGHT_INPUT_OPERATIONS || sameGeometry(geometry, this.sentGeometry)) return;
    const encoded = encodeSemanticInput({ kind: "resize", ...geometry });
    if (!encoded) return;
    this.geometryOperation = this.appendOperation(
      { operation: encoded, kind: "resize", requestedBytes: encoded.bodyBytes },
      stream
    );
  }

  /** Sends queued operations in order while the route is attached and the window has room. */
  private pumpInputs(): void {
    const stream = this.streamSubscription;
    if (!stream?.sendFrame || !this.attachedReceived || this.detached) return;
    // The latest geometry goes ahead of queued operations.
    this.maybeSendGeometry();
    while (this.inflightInputs.size < MAX_INFLIGHT_INPUT_OPERATIONS) {
      const entry = this.queuedInputs.shift();
      if (!entry) return;
      this.queuedInputBytes -= entry.operation.bodyBytes;
      this.appendOperation(entry, stream);
    }
  }

  /** Gives `entry` the next operation id and appends its send to the ordered send chain. */
  private appendOperation(
    entry: QueuedInputOperation,
    stream: DaemonTerminalStreamSubscription
  ): InflightInputOperation {
    const generation = this.attachmentGeneration;
    const operationId = this.nextOperationId++;
    const inflight: InflightInputOperation = {
      ...entry,
      generation,
      operationId,
      retainedBytes: entry.operation.bodyBytes
    };
    this.inflightInputs.set(operationId, inflight);
    this.inflightInputBytes += inflight.retainedBytes;
    this.inputSendChain = this.inputSendChain
      .then(async () => {
        await this.testHooks?.beforeInputSend?.();
        if (!this.isCurrentAttachment(generation) || this.streamSubscription !== stream) {
          this.settleInflight(inflight, "cancelled", "Terminal attachment changed before the operation was sent.");
          return;
        }
        if (inflight === this.geometryOperation) {
          // The RESIZE reads the latest geometry now. It is not sent while a ROUTE_RESYNC
          // hydration is incomplete or when the route already has this geometry; then its
          // slot is released without a send (the unused id leaves a gap, which Core allows:
          // ids must only increase) and the pump runs again.
          const geometry = this.desiredGeometry;
          const encoded =
            geometry && this.screenHydrated() && !sameGeometry(geometry, this.sentGeometry)
              ? encodeSemanticInput({ kind: "resize", ...geometry })
              : undefined;
          if (!geometry || !encoded) {
            this.releaseUnsentOperation(inflight);
            this.pumpInputs();
            return;
          }
          inflight.operation = encoded;
          this.sentGeometry = { ...geometry };
        }
        // Frames are built once, sent in order, and released; the payload closure goes
        // with them so a paste holds no third copy while Core retains the operation.
        const frames = inflight.operation.frames(operationId);
        const abortFrame = inflight.operation.abortFrame?.(operationId);
        const frameCount = frames.length;
        inflight.operation = releasedOperation(inflight.retainedBytes);
        let sentFrames = 0;
        try {
          for (const frame of frames) {
            await stream.sendFrame!(frame);
            sentFrames += 1;
          }
        } catch (error: unknown) {
          // A paste that stopped after PASTE_BEGIN leaves Core assembling; abort it on the
          // same stream, best effort, so the route's one assembling paste is released.
          if (abortFrame && sentFrames > 0 && sentFrames < frameCount && this.streamSubscription === stream) {
            await stream.sendFrame!(abortFrame).catch(() => undefined);
          }
          throw error;
        }
        recordLiveHarnessTerminal("input_sent", {
          kind: inflight.kind,
          operation_id: operationId,
          frames: frameCount,
          bytes: inflight.retainedBytes,
          generation
        });
      })
      .catch((error: unknown) => {
        this.settleInflight(
          inflight,
          "cancelled",
          `Input was not sent: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    return inflight;
  }

  /** Releases an operation that was never sent: no INPUT_RESULT will arrive for it. */
  private releaseUnsentOperation(inflight: InflightInputOperation): void {
    if (this.inflightInputs.get(inflight.operationId) !== inflight) return;
    this.inflightInputs.delete(inflight.operationId);
    this.inflightInputBytes -= inflight.retainedBytes;
    if (this.geometryOperation === inflight) this.geometryOperation = undefined;
  }

  private settleInflight(
    inflight: InflightInputOperation,
    outcome: TerminalInputOutcomeName,
    detail: string,
    counts: { acceptedPayloadBytes?: number; writtenPtyBytes?: number } = {}
  ): void {
    if (this.inflightInputs.get(inflight.operationId) !== inflight) return;
    this.inflightInputs.delete(inflight.operationId);
    this.inflightInputBytes -= inflight.retainedBytes;
    if (this.geometryOperation === inflight) this.geometryOperation = undefined;
    let unsafePasteConsent: UnsafePasteConsent | undefined;
    if (
      outcome === "rejected_unsafe_paste" &&
      counts.acceptedPayloadBytes === 0 &&
      counts.writtenPtyBytes === 0 &&
      inflight.kind === "paste" &&
      inflight.pasteData !== undefined &&
      inflight.pasteAttempt === this.pasteAttempt &&
      this.isCurrentAttachment(inflight.generation)
    ) {
      this.releaseUnsafePasteConsent();
      unsafePasteConsent = Object.freeze({
        attachmentGeneration: inflight.generation,
        rejectedOperationId: inflight.operationId,
        expiresAt: Date.now() + (this.testHooks?.unsafePasteConsentTimeoutMs ?? UNSAFE_PASTE_CONSENT_TIMEOUT_MS)
      });
      const pending: PendingUnsafePaste = {
        consent: unsafePasteConsent,
        data: inflight.pasteData,
        timeout: setTimeout(() => {
          if (this.pendingUnsafePaste === pending) this.releaseUnsafePasteConsent();
        }, this.testHooks?.unsafePasteConsentTimeoutMs ?? UNSAFE_PASTE_CONSENT_TIMEOUT_MS)
      };
      this.pendingUnsafePaste = pending;
      // A paste operation's bodyBytes is the raw payload length, which equals data.byteLength.
      this.consentRetainedBytes = inflight.retainedBytes;
      this.assertUnsafePasteConsentAccounting();
    }
    const result: TerminalInputOutcome = {
      kind: inflight.kind,
      outcome,
      operationId: inflight.operationId,
      requestedBytes: inflight.requestedBytes,
      ...counts,
      ...(unsafePasteConsent ? { unsafePasteConsent } : {}),
      detail
    };
    if (inflight.resolve) {
      inflight.resolve(result);
    } else {
      this.publishOutcome(result);
    }
    this.pumpInputs();
  }

  /** Every in-flight operation on the lost generation ends `outcome_unknown`; unsent ones are cancelled. */
  private abandonInputs(reason: string): void {
    for (const inflight of [...this.inflightInputs.values()]) {
      this.settleInflight(inflight, "outcome_unknown", reason);
    }
    for (const entry of this.queuedInputs.splice(0)) {
      const result: TerminalInputOutcome = {
        kind: entry.kind,
        outcome: "cancelled",
        requestedBytes: entry.requestedBytes,
        detail: reason
      };
      if (entry.resolve) entry.resolve(result);
      else this.publishOutcome(result);
    }
    this.queuedInputBytes = 0;
    this.inflightInputBytes = 0;
    this.releaseUnsafePasteConsent();
    // The new attachment gets the latest geometry after its first FINISH.
    this.sentGeometry = undefined;
    this.geometryOperation = undefined;
    this.nextOperationId = 1;
  }

  private handleInputResult(result: InputResultBody): void {
    recordLiveHarnessTerminal("input_result", {
      operation_id: Number(result.operation_id),
      outcome: result.outcome,
      accepted_payload_bytes: result.accepted_payload_bytes === null ? null : Number(result.accepted_payload_bytes),
      written_pty_bytes: result.written_pty_bytes === null ? null : Number(result.written_pty_bytes),
      mode_bits: result.mode_bits,
      detail: result.detail
    });
    // Operation ids are client-chosen small integers, so the u64 converts exactly.
    const inflight = this.inflightInputs.get(Number(result.operation_id));
    if (!inflight || inflight.generation !== this.attachmentGeneration) {
      // Unknown or already completed id: reported, never retained.
      recordLiveHarnessTerminal("input_result_unmatched", {
        operation_id: Number(result.operation_id),
        outcome: result.outcome
      });
      return;
    }
    const counts = {
      ...(result.accepted_payload_bytes !== null ? { acceptedPayloadBytes: Number(result.accepted_payload_bytes) } : {}),
      ...(result.written_pty_bytes !== null ? { writtenPtyBytes: Number(result.written_pty_bytes) } : {})
    };
    const detail = result.detail || describeOutcome(inflight.kind, result.outcome, counts);
    this.settleInflight(inflight, result.outcome, detail, counts);
  }

  // ---------------------------------------------------------------------------
  // Subscriptions.
  // ---------------------------------------------------------------------------

  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription {
    this.listeners.add(listener);
    // A publicly detached plane must not resurrect. Remount uses a new plane or
    // a new subscription generation, not a cleared `detached` flag on this id.
    if (this.detached) {
      return {
        unsubscribe: () => {
          this.listeners.delete(listener);
        }
      };
    }
    this.emitStatus({ state: "attaching", message: "Attaching terminal stream." });
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
        if (this.listeners.size === 0 && !this.detached) {
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

  subscribeModes(listener: (modes: TerminalModes) => void): TerminalSubscription {
    this.modesListeners.add(listener);
    if (this.currentModes) listener(this.currentModes);
    return {
      unsubscribe: () => {
        this.modesListeners.delete(listener);
      }
    };
  }

  subscribeInputOutcomes(listener: (outcome: TerminalInputOutcome) => void): TerminalSubscription {
    this.outcomeListeners.add(listener);
    return {
      unsubscribe: () => {
        this.outcomeListeners.delete(listener);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Host-control readback (low-rate control, paged).
  // ---------------------------------------------------------------------------

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

  async captureSnapshot(): Promise<Uint8Array | undefined> {
    const attachmentGeneration = this.attachmentGeneration;
    const response = await this.options.bridge.request({
      type: "capture_snapshot",
      session_id: this.sessionId
    });
    const capture = response.capture_snapshot ?? undefined;
    if (!capture || !this.isCurrentAttachment(attachmentGeneration) || capture.unavailable) {
      return undefined;
    }
    const assembled = new Uint8Array(Number(capture.total_bytes));
    let offset = 0;
    for (let page = 0; page < capture.pages; page += 1) {
      const pageResponse = await this.options.bridge.request({
        type: "read_snapshot_page",
        session_id: this.sessionId,
        capture_id: capture.capture_id,
        page
      });
      const body = pageResponse.snapshot_page;
      if (!body || body.capture_id !== capture.capture_id || body.page !== page) {
        throw new Error(`Snapshot page ${page} of capture ${capture.capture_id} was not returned.`);
      }
      const bytes = base64ToBytes(body.payload_base64);
      if (offset + bytes.byteLength > assembled.byteLength) {
        throw new Error(`Snapshot pages exceed the declared ${capture.total_bytes} bytes.`);
      }
      assembled.set(bytes, offset);
      offset += bytes.byteLength;
      if (!this.isCurrentAttachment(attachmentGeneration)) return undefined;
    }
    if (offset !== assembled.byteLength) {
      throw new Error(`Snapshot pages delivered ${offset} of ${capture.total_bytes} bytes.`);
    }
    return assembled;
  }

  // ---------------------------------------------------------------------------
  // Attachment lifecycle.
  // ---------------------------------------------------------------------------

  async detach(): Promise<void> {
    if (this.detached) return;
    this.detached = true;
    this.transportLost = false;
    const heldSubscriptionId = this.subscriptionId;
    const heldGeneration = this.hydration?.generation ?? this.attachmentGeneration;
    this.closeStreamWithoutDetachRequest("Terminal detached before the operation completed.");
    this.listeners.clear();
    this.statusListeners.clear();
    this.modesListeners.clear();
    this.outcomeListeners.clear();
    this.uninstallLifecycleListener();
    // One Detach owner for the held subscription generation. Public cancel also
    // blocks later Detach for this subscription id even after generation bump.
    await this.sendDetachRequestOnce(heldSubscriptionId, heldGeneration);
  }

  private uninstallLifecycleListener(): void {
    this.lifecycleSubscription?.unsubscribe();
    this.lifecycleSubscription = undefined;
  }

  /**
   * DataChannel lost: abandon the current stream and subscription generation but keep
   * mounted listeners so recovery can re-attach without unmounting the renderer.
   */
  private handleTransportLost(): void {
    // One loss per attachment: a closed event that follows an error event for the same
    // transport, or any repeat before recovery, changes nothing.
    if (this.detached || this.transportLost) return;
    this.transportLost = true;
    const previousSubscriptionId = this.subscriptionId;
    const previousGeneration = this.hydration?.generation ?? this.attachmentGeneration;
    this.lastAbandonedDetach = {
      subscriptionId: previousSubscriptionId,
      generation: previousGeneration,
      attachSent: this.attachedReceived || this.streamSubscription?.attachSent === true
    };
    this.closeStreamWithoutDetachRequest("Terminal stream was lost; delivery is unknown.");
    this.emitStatus({
      state: "attaching",
      message: "WebRTC data channel lost; waiting to reattach terminal stream."
    });
    recordLiveHarnessTerminal("transport_lost", {
      sessionId: this.sessionId,
      subscription_id: previousSubscriptionId,
      generation: previousGeneration
    });
  }

  /**
   * DataChannel recovered on a surviving document: mint a fresh subscription id and
   * re-run the attach ordering for the still-mounted view.
   */
  private handleTransportRecovered(): void {
    if (this.detached || !this.transportLost || this.listeners.size === 0) return;
    this.transportLost = false;
    this.snapshotRecoveries = 0;
    const previousSubscriptionId = this.subscriptionId;
    if (!this.fixedSubscriptionId) {
      this.subscriptionId = createTerminalSubscriptionId();
    }
    recordLiveHarnessTerminal("transport_recovered", {
      sessionId: this.sessionId,
      subscription_id: this.subscriptionId,
      previous_subscription_id: previousSubscriptionId
    });
    this.emitStatus({
      state: "attaching",
      message: "Reattaching terminal stream after WebRTC recovery."
    });
    void (async () => {
      const abandoned = this.lastAbandonedDetach;
      this.lastAbandonedDetach = undefined;
      if (abandoned && previousSubscriptionId !== this.subscriptionId && !abandoned.attachSent) {
        // The superseded Attach never left the control channel: Hub holds nothing for it.
        recordLiveHarnessTerminal("detach_skipped_unsent", {
          subscription_id: abandoned.subscriptionId,
          generation: abandoned.generation
        });
      } else if (abandoned && previousSubscriptionId !== this.subscriptionId) {
        try {
          await this.sendDetachRequestOnce(abandoned.subscriptionId, abandoned.generation);
        } catch (error: unknown) {
          recordLiveHarnessTerminal("stale_detach_ignored", {
            message: error instanceof Error ? error.message : String(error),
            subscription_id: previousSubscriptionId
          });
        }
      }
      if (this.detached || this.listeners.size === 0) return;
      await this.ensureAttached();
    })().catch((error: unknown) => {
      this.emitStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Terminal stream reattach failed."
      });
      recordLiveHarnessTerminal("attach_failed", {
        message: error instanceof Error ? error.message : String(error),
        stage: "transport_recovered"
      });
    });
  }

  private closeStreamWithoutDetachRequest(inputReason: string): void {
    const sub = this.streamSubscription;
    sub?.abandon();
    this.resetAttachmentState(inputReason);
  }

  private closeStream(): void {
    const stream = this.streamSubscription;
    const subscriptionId = this.subscriptionId;
    const generation = this.hydration?.generation ?? this.attachmentGeneration;
    if (stream) {
      stream.abandon();
      // Last-listener and fail paths share the same Detach owner as public detach.
      void this.sendDetachRequestOnce(subscriptionId, generation).catch(() => undefined);
    }
    this.resetAttachmentState("Terminal stream closed before the operation completed.");
  }

  /** Drops the stream handle, hydration, modes, and every input operation for this generation. */
  private resetAttachmentState(inputReason: string): void {
    this.streamSubscription = undefined;
    this.attachPromise = undefined;
    this.attachmentGeneration += 1;
    this.attachedReceived = false;
    this.routeGeneration = undefined;
    this.acceptedEpoch = undefined;
    this.cancelHydration();
    this.terminalEventQueue = Promise.resolve();
    this.inputSendChain = Promise.resolve();
    this.abandonInputs(inputReason);
    this.currentModes = undefined;
  }

  private cancelHydration(): void {
    const hydration = this.hydration;
    if (!hydration) return;
    if (hydration.reader) {
      recordLiveHarnessTerminal("reader_cancel", {
        generation: hydration.generation,
        subscription_id: this.subscriptionId,
        sessionId: this.sessionId
      });
      hydration.reader.cancel();
    }
    if (hydration.progressTimeout !== undefined) {
      clearTimeout(hydration.progressTimeout);
    }
    this.hydration = undefined;
  }

  private ensureAttached(): Promise<void> {
    if (this.detached && this.listeners.size === 0) {
      return Promise.resolve();
    }
    if (this.attachPromise) return this.attachPromise;
    if (this.streamSubscription) return Promise.resolve();
    if (!this.options.bridge.streamTerminal) {
      throw new Error("WebRTC client does not expose terminal streaming.");
    }

    const attachPromise = this.attachToAuthoritativeSession();
    this.attachPromise = attachPromise;
    const clearAttachPromise = () => {
      if (this.attachPromise === attachPromise) {
        this.attachPromise = undefined;
      }
    };
    void attachPromise.then(clearAttachPromise, clearAttachPromise);
    return attachPromise;
  }

  private isCurrentAttachment(attachmentGeneration: number): boolean {
    return !this.detached && this.attachmentGeneration === attachmentGeneration;
  }

  private async attachToAuthoritativeSession(): Promise<void> {
    if (this.streamSubscription || this.listeners.size === 0) {
      return;
    }

    const attachmentGeneration = ++this.attachmentGeneration;
    this.nextOperationId = 1;
    this.attachedReceived = false;
    await this.testHooks?.beforeAttachAcquire?.();
    if (!this.isCurrentAttachment(attachmentGeneration) || this.listeners.size === 0) {
      return;
    }
    if (!this.options.bridge.streamTerminal) {
      throw new Error("WebRTC client does not expose terminal streaming.");
    }

    this.ensureHydration(attachmentGeneration);
    const streamSubscription = this.options.bridge.streamTerminal(
      this.sessionId,
      this.subscriptionId,
      (event) => this.enqueueTerminalEvent(event, attachmentGeneration)
    );
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      // Public cancel owns Detach. Abandon the leftover stream; do not emit a second Detach.
      streamSubscription.abandon();
      if (!this.detached && !this.hasSentDetachFor(this.subscriptionId, attachmentGeneration)) {
        void this.sendDetachRequestOnce(this.subscriptionId, attachmentGeneration).catch(() => undefined);
      }
      return;
    }
    this.streamSubscription = streamSubscription;
    this.routeGeneration = undefined;
    this.acceptedEpoch = undefined;
    if (!this.detached) {
      this.detachSentFor = undefined;
    }
    recordLiveHarnessTerminal("attach", {
      generation: attachmentGeneration,
      subscription_id: this.subscriptionId,
      sessionId: this.sessionId
    });
    await streamSubscription.ready;
    if (!this.isCurrentAttachment(attachmentGeneration)) return;
    if (typeof streamSubscription.generation === "number") {
      this.routeGeneration = streamSubscription.generation;
    }
    const hydration = this.hydration;
    if (hydration?.generation === attachmentGeneration && !hydration.completed) {
      this.armHydrationProgressBound(hydration);
    }
  }

  private enqueueTerminalEvent(event: TerminalStreamEvent, attachmentGeneration: number): Promise<void> {
    const delivery = this.terminalEventQueue.then(() => this.emitTerminalEvent(event, attachmentGeneration));
    this.terminalEventQueue = delivery.catch((error: unknown) => {
      recordLiveHarnessTerminal("event_delivery_failed", {
        message: error instanceof Error ? error.message : String(error),
        generation: attachmentGeneration,
        subscription_id: this.subscriptionId
      });
    });
    return delivery;
  }

  /**
   * One Detach owner for a subscription generation. Marks the once-flag before await
   * so concurrent emitters skip. Public cancel also suppresses later Detach for that
   * subscription id. Races the bridge request against DETACH_REQUEST_BOUND_MS.
   */
  private async sendDetachRequestOnce(subscriptionId: string, generation: number): Promise<void> {
    if (this.hasSentDetachFor(subscriptionId, generation)) return;
    this.detachSentFor = { subscriptionId, generation };
    const boundMs = this.testHooks?.detachRequestBoundMs ?? DETACH_REQUEST_BOUND_MS;
    const requestPromise = this.options.bridge.request({
      type: "detach",
      session_id: this.sessionId,
      subscription_id: subscriptionId
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`detach request exceeded ${boundMs}ms bound`));
      }, boundMs);
    });
    try {
      await Promise.race([requestPromise, timeoutPromise]);
    } catch (error: unknown) {
      // Keep the once-flag so a late resolve cannot send a second Detach.
      void requestPromise.catch(() => undefined);
      throw error;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  private hasSentDetachFor(subscriptionId: string, generation: number): boolean {
    if (!this.detachSentFor) return false;
    if (this.detached && this.detachSentFor.subscriptionId === subscriptionId) return true;
    return this.detachSentFor.subscriptionId === subscriptionId && this.detachSentFor.generation === generation;
  }

  // ---------------------------------------------------------------------------
  // Route frames: ATTACH_STATE attached, MODES, SNAPSHOT_READY, live OUTPUT interleaved
  // with SNAPSHOT_HISTORY, SNAPSHOT_FINISH, then OUTPUT, PROCESS_EXIT last.
  // ---------------------------------------------------------------------------

  private async emitTerminalEvent(event: TerminalStreamEvent, attachmentGeneration: number): Promise<void> {
    if (!this.isCurrentAttachment(attachmentGeneration)) return;

    if ("type" in event) {
      if (event.subscription_id !== this.subscriptionId || event.session_id !== this.sessionId) return;
      recordLiveHarnessTerminal("terminal_subscription_closed", {
        reason: event.reason,
        generation: event.generation,
        subscription_id: event.subscription_id
      });
      if (event.reason === "core_adapter_closed") {
        this.emitStatus({ state: "failed", message: "Terminal subscription closed by Core write-budget." });
        this.closeStream();
      }
      return;
    }

    if (event.route !== this.subscriptionId) return;
    await this.testHooks?.beforeListenerDelivery?.();
    if (!this.isCurrentAttachment(attachmentGeneration)) return;
    await this.receiveRouteFrame(event, attachmentGeneration);
  }

  private async receiveRouteFrame(frame: TerminalRouteFrame, attachmentGeneration: number): Promise<void> {
    let decoded: TerminalEvent;
    try {
      decoded = decodeTerminalBody(frame.body);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid terminal frame.";
      recordLiveHarnessTerminal("frame_decode_failed", { message, generation: attachmentGeneration });
      this.failRoute(`Terminal frame could not be decoded: ${message}`);
      return;
    }
    recordLiveHarnessRouteFrame(frame, decoded);
    if (!this.admitRouteGeneration(frame.generation)) {
      recordLiveHarnessTerminal("frame_stale_generation", {
        frame_generation: frame.generation,
        route_generation: this.routeGeneration,
        kind: decoded.kind
      });
      return;
    }
    if (!this.admitStreamEpoch(frame.streamEpoch, decoded)) {
      recordLiveHarnessTerminal("frame_stale_epoch", {
        frame_epoch: frame.streamEpoch,
        accepted_epoch: this.acceptedEpoch,
        kind: decoded.kind
      });
      return;
    }
    switch (decoded.kind) {
      case "output":
        // The payload is a view of the transport buffer; the renderer copies it once.
        this.receiveOutput(decoded.payload, attachmentGeneration);
        return;
      case "snapshot_ready":
      case "snapshot_history":
        await this.installIncrementalSnapshotFrame(
          this.ensureHydration(attachmentGeneration),
          decoded.payload,
          decoded.kind === "snapshot_ready"
        );
        return;
      case "snapshot_finish":
        this.receiveSnapshotFinish(this.ensureHydration(attachmentGeneration));
        return;
      case "process_exit":
        this.receiveProcessExit(decoded.code, attachmentGeneration);
        return;
      case "modes":
        this.receiveModes({ modeBits: decoded.mode_bits, rows: decoded.rows, cols: decoded.cols });
        return;
      case "attach_state":
        this.receiveAttachState(decoded.state, attachmentGeneration);
        return;
      case "input_result":
        this.handleInputResult(decoded.result);
        return;
      case "history_unavailable":
        this.receiveHistoryUnavailable(decoded.reason, attachmentGeneration);
        return;
      case "route_resync":
        this.receiveRouteResync(decoded.to_epoch, attachmentGeneration);
        return;
    }
  }

  /**
   * Attachment identity fence. The reservation fixes the route generation for the life of
   * this attachment; a frame with any other generation is stale data from a retired
   * subscription and is discarded, never continued. Snapshot and live continuity across
   * ROUTE_RESYNC is a separate stream epoch that Core defines on the data frames.
   */
  private admitRouteGeneration(generation: number): boolean {
    if (this.routeGeneration === undefined) {
      this.routeGeneration = generation;
      return true;
    }
    return generation === this.routeGeneration;
  }

  /**
   * Stream epoch fence within the attachment. Before ATTACH_STATE attached only attach-state
   * frames are admitted. ROUTE_RESYNC is accepted only when its from_epoch equals the
   * accepted epoch and its envelope epoch equals its to_epoch. Stream state kinds (OUTPUT,
   * MODES, snapshot frames, HISTORY_UNAVAILABLE, PROCESS_EXIT) must carry the accepted
   * epoch; a stale frame is dropped, never continued. INPUT_RESULT is correlated by
   * operation id within the attachment regardless of epoch: Core preserves accepted results
   * across a resync and re-stamps them, so exactly one result reaches each operation.
   */
  private admitStreamEpoch(streamEpoch: number, decoded: TerminalEvent): boolean {
    if (decoded.kind === "attach_state" || decoded.kind === "input_result") return true;
    if (this.acceptedEpoch === undefined) return false;
    if (decoded.kind === "route_resync") {
      return (
        decoded.from_epoch === this.acceptedEpoch &&
        decoded.to_epoch !== decoded.from_epoch &&
        decoded.to_epoch === streamEpoch
      );
    }
    return streamEpoch === this.acceptedEpoch;
  }

  private receiveAttachState(state: AttachStateCodeName, attachmentGeneration: number): void {
    recordLiveHarnessTerminal("attach_state", { state });
    if (state === "attached") {
      this.attachedReceived = true;
      // The accepted epoch is defined by the contract, not read from the frame.
      this.acceptedEpoch = 0;
      this.emitStatus({ state: "attaching", message: "Terminal route attached; waiting for the visible screen." });
      this.pumpInputs();
      return;
    }
    if (state === "attaching") {
      this.emitStatus({ state: "attaching", message: "Terminal route is attaching." });
      return;
    }
    if (state === "failed") {
      const hydration = this.hydration;
      if (hydration?.generation === attachmentGeneration && !hydration.readyReceived) {
        this.recoverRoute(hydration, "Terminal attach failed before the visible screen.");
        return;
      }
      this.failRoute("Terminal attach failed.");
      return;
    }
    if (state === "detached") {
      this.emitStatus({ state: "failed", message: "Terminal route was detached by the host." });
      this.closeStream();
    }
  }

  private receiveModes(modes: TerminalModes): void {
    this.currentModes = modes;
    recordLiveHarnessTerminal("modes", modes);
    for (const listener of this.modesListeners) listener(modes);
  }

  private receiveOutput(bytes: Uint8Array, attachmentGeneration: number): void {
    const hydration = this.hydration;
    if (hydration?.generation === attachmentGeneration && !hydration.completed) {
      this.bufferHydratingOutput(bytes, hydration);
      return;
    }
    this.emitOutput(bytes);
  }

  private receiveProcessExit(code: number | null, attachmentGeneration: number): void {
    const exitCode = code;
    const hydration = this.hydration;
    if (hydration?.generation === attachmentGeneration && !hydration.completed) {
      hydration.pendingExit = exitCode;
      return;
    }
    this.emitProcessExit(exitCode);
  }

  /**
   * HISTORY_UNAVAILABLE arrives only after SNAPSHOT_READY on a live route (Core ruling): the
   * visible screen is restored and capture_failed replaces the remaining history pages.
   * The route stays inside its snapshot boundary until Core sends SNAPSHOT_FINISH; further
   * history frames are ignored and the attach then completes with incomplete history. A
   * capture failure before READY arrives as ATTACH_STATE failed instead, so a pre-READY
   * HISTORY_UNAVAILABLE is a protocol violation and never paints live deltas blind.
   */
  private receiveHistoryUnavailable(reason: HistoryUnavailableReasonName, attachmentGeneration: number): void {
    recordLiveHarnessTerminal("history_unavailable", { reason });
    const hydration = this.ensureHydration(attachmentGeneration);
    const label = historyUnavailableLabel(reason);
    if (!hydration.readyReceived) {
      hydration.reader?.cancel();
      this.failRoute(`Terminal sent HISTORY_UNAVAILABLE (${label}) before SNAPSHOT_READY.`);
      return;
    }
    hydration.historyIncomplete = true;
    hydration.reader?.cancel();
    this.emitStatus({
      state: "attaching",
      message: `Terminal screen restored; scrollback history is unavailable (${label}).`
    });
  }

  /**
   * Egress overflow on this route: Core opens a new stream epoch and restarts the route at
   * MODES and a fresh SNAPSHOT_READY. Everything decoded for the old epoch is discarded;
   * nothing is continued or replayed. In-flight input operations stay pending: their
   * INPUT_RESULT arrives in the new epoch, or they resolve as unknown when the route closes.
   */
  private receiveRouteResync(toEpoch: number, attachmentGeneration: number): void {
    recordLiveHarnessTerminal("route_resync", {
      generation: attachmentGeneration,
      from_epoch: this.acceptedEpoch,
      to_epoch: toEpoch,
      subscription_id: this.subscriptionId
    });
    this.acceptedEpoch = toEpoch;
    this.releaseUnsafePasteConsent();
    this.cancelHydration();
    this.ensureHydration(attachmentGeneration);
    this.emitStatus({ state: "attaching", message: "Terminal route resynchronizing after egress overflow." });
    this.armHydrationProgressBound(this.hydration!);
  }

  private releaseUnsafePasteConsent(): void {
    const pending = this.pendingUnsafePaste;
    this.pendingUnsafePaste = undefined;
    this.consentRetainedBytes = 0;
    if (pending) clearTimeout(pending.timeout);
    this.assertUnsafePasteConsentAccounting();
  }

  private assertUnsafePasteConsentAccounting(): void {
    const expected = this.pendingUnsafePaste?.data.byteLength ?? 0;
    if (this.consentRetainedBytes !== expected) {
      throw new Error(
        `Unsafe paste consent accounting mismatch: retained=${this.consentRetainedBytes} expected=${expected}.`
      );
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
      readyReceived: false,
      decoderFinished: false,
      finishReceived: false,
      historyIncomplete: false,
      completed: false,
      reader: this.incrementalSnapshotReaderFactory?.()
    };
    this.hydration = hydration;
    return hydration;
  }

  private async installIncrementalSnapshotFrame(
    hydration: ScreenHydration,
    bytes: Uint8Array,
    ready: boolean
  ): Promise<void> {
    const attachmentGeneration = hydration.generation;
    recordLiveHarnessTerminal("snapshot", { bytes: bytes.byteLength, phase: ready ? "ready" : "history" });
    await this.testHooks?.beforeSnapshotInstall?.();
    if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) return;
    if (hydration.completed) {
      this.failRoute("Terminal snapshot frame arrived after the route completed hydration.");
      return;
    }
    if (ready ? hydration.readyReceived : !hydration.readyReceived) {
      this.failRoute(ready ? "Terminal sent SNAPSHOT_READY twice." : "Terminal sent SNAPSHOT_HISTORY before SNAPSHOT_READY.");
      return;
    }
    if (hydration.historyIncomplete || hydration.decoderFinished) {
      // History was declared unavailable or the decoder already saw its finish record; later
      // pages are ignored until SNAPSHOT_FINISH closes the boundary.
      recordLiveHarnessTerminal("snapshot_history_ignored", { bytes: bytes.byteLength, generation: attachmentGeneration });
      return;
    }

    const reader = hydration.reader;
    if (!reader) {
      this.failRoute("Restty incremental snapshot reader is not bound.");
      return;
    }
    let progress;
    try {
      progress = await reader.read(bytes);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid terminal snapshot payload.";
      if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) return;
      this.recoverRoute(hydration, message);
      return;
    }
    if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) return;

    if (progress === "ready") {
      if (!ready) {
        this.failRoute("Restty returned READY for a history frame.");
        return;
      }
      hydration.readyReceived = true;
      this.emitStatus({
        state: "attaching",
        message: "Visible terminal screen restored at snapshot READY; loading history."
      });
    } else if (progress === "page") {
      if (ready) {
        this.failRoute("Restty returned PAGE for the READY frame.");
        return;
      }
    } else if (progress === "finish") {
      // The GHOSTSNP finish record is the last SNAPSHOT_HISTORY page; the route closes the
      // boundary with an empty SNAPSHOT_FINISH afterwards.
      if (ready) {
        this.failRoute("Restty returned FINISH for the READY frame.");
        return;
      }
      hydration.decoderFinished = true;
    } else {
      this.failRoute(`Restty returned unknown snapshot progress ${String(progress)}.`);
      return;
    }

    recordLiveHarnessTerminal("ghostsnp_install", {
      bytes: bytes.byteLength,
      generation: attachmentGeneration,
      progress,
      subscription_id: this.subscriptionId
    });
    this.armHydrationProgressBound(hydration);
  }

  private receiveSnapshotFinish(hydration: ScreenHydration): void {
    if (hydration.completed) return;
    if (!hydration.readyReceived) {
      this.failRoute("Terminal sent SNAPSHOT_FINISH before SNAPSHOT_READY.");
      return;
    }
    hydration.finishReceived = true;
    if (!hydration.decoderFinished && !hydration.historyIncomplete) {
      // SNAPSHOT_FINISH without the decoder's finish record: the history assembly ended
      // early. Release the decoder and keep the READY screen; the attach is incomplete.
      hydration.historyIncomplete = true;
      hydration.reader?.cancel();
    }
    this.completeHydration(
      hydration,
      hydration.historyIncomplete
        ? "Terminal attached with incomplete snapshot history."
        : "Terminal attached after incremental snapshot history."
    );
  }

  private completeHydration(hydration: ScreenHydration, message: string): void {
    const attachmentGeneration = hydration.generation;
    if (hydration.completed || this.hydration !== hydration) return;
    hydration.completed = true;
    if (hydration.progressTimeout !== undefined) {
      clearTimeout(hydration.progressTimeout);
      hydration.progressTimeout = undefined;
    }
    this.emitStatus({ state: "attached", message });

    for (const data of hydration.bufferedOutput) {
      if (!this.isCurrentAttachment(attachmentGeneration)) return;
      this.emitOutput(data);
    }
    hydration.bufferedOutput = [];
    hydration.bufferedBytes = 0;
    if (hydration.pendingExit !== undefined) {
      this.emitProcessExit(hydration.pendingExit);
    }
    this.pumpInputs();
  }

  private failRoute(message: string): void {
    this.emitStatus({ state: "failed", message });
    recordLiveHarnessTerminal("route_failed", { message });
    this.closeStream();
  }

  /** One fresh attach with a new subscription id for a lost snapshot; a second loss fails. */
  private recoverRoute(hydration: ScreenHydration, message: string): void {
    if (this.hydration !== hydration) return;
    if (this.snapshotRecoveries >= 1 || this.fixedSubscriptionId) {
      this.failRoute(message);
      return;
    }
    this.snapshotRecoveries += 1;
    const previousSubscriptionId = this.subscriptionId;
    recordLiveHarnessTerminal("snapshot_lost_recover", { message, previous_subscription_id: previousSubscriptionId });
    this.closeStream();
    this.subscriptionId = createTerminalSubscriptionId();
    this.emitStatus({ state: "attaching", message: "Lost snapshot page; starting a fresh attach." });
    void this.ensureAttached().catch((error: unknown) => {
      this.emitStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Fresh terminal attach failed."
      });
    });
  }

  private armHydrationProgressBound(hydration: ScreenHydration): void {
    if (this.hydration !== hydration || hydration.completed) return;
    if (hydration.progressTimeout !== undefined) {
      clearTimeout(hydration.progressTimeout);
    }
    const boundMs = this.testHooks?.hydrationProgressBoundMs ?? localWebrtcResponseChunkLimits.requestTimeoutMs;
    hydration.progressTimeout = setTimeout(() => {
      hydration.progressTimeout = undefined;
      if (this.hydration !== hydration || hydration.completed) return;
      const message = `Terminal snapshot attach made no progress within ${boundMs}ms.`;
      recordLiveHarnessTerminal("hydration_progress_timeout", {
        generation: hydration.generation,
        subscription_id: this.subscriptionId,
        ready_received: hydration.readyReceived,
        finish_received: hydration.finishReceived
      });
      this.recoverRoute(hydration, message);
    }, boundMs);
  }

  /**
   * Live OUTPUT before SNAPSHOT_FINISH waits for the snapshot to finish so the renderer
   * applies one capture boundary in order. The wait is bounded by the client pending
   * limits; overflow detaches and re-attaches this route only, never dropping bytes silently.
   */
  private bufferHydratingOutput(data: Uint8Array, hydration: ScreenHydration): void {
    const bufferedBytes = hydration.bufferedBytes + data.byteLength;
    if (
      bufferedBytes > MAX_PENDING_TERMINAL_BYTES ||
      hydration.bufferedOutput.length + 1 > MAX_PENDING_TERMINAL_ITEMS
    ) {
      recordLiveHarnessTerminal("pending_overflow", {
        items: hydration.bufferedOutput.length + 1,
        bytes: bufferedBytes,
        generation: hydration.generation
      });
      this.recoverRoute(hydration, "Terminal pending output exceeded the client bound during snapshot history.");
      return;
    }
    hydration.bufferedOutput.push(data);
    hydration.bufferedBytes = bufferedBytes;
  }

  private emitOutput(data: TerminalOutput): void {
    for (const listener of this.listeners) {
      listener(data);
    }
    if (liveHarnessTerminalRecorderInstalled()) {
      recordLiveHarnessTerminal("output", { payload_bytes_base64: bytesToBase64(data), bytes: data.byteLength, source: "output" });
    }
  }

  private emitProcessExit(code: number | null): void {
    this.emitStatus({
      state: "exited",
      message: typeof code === "number" ? `Terminal process exited with ${code}.` : "Terminal process exited."
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

  private publishOutcome(outcome: TerminalInputOutcome): void {
    for (const listener of this.outcomeListeners) {
      listener(outcome);
    }
  }
}

/** Placeholder for a sent operation: accounting stays, the payload closure is gone. */
function releasedOperation(bodyBytes: number): EncodedInputOperation {
  return {
    bodyBytes,
    frames: () => {
      throw new Error("Input operation frames were already sent.");
    }
  };
}

function describeOutcome(
  kind: TerminalInputOutcome["kind"],
  outcome: TerminalInputOutcomeName,
  counts: { acceptedPayloadBytes?: number; writtenPtyBytes?: number }
): string {
  const written = counts.writtenPtyBytes !== undefined ? `${counts.writtenPtyBytes} PTY bytes written` : "PTY byte count unknown";
  switch (outcome) {
    case "written":
      return `Terminal accepted the ${kind} operation; ${written}.`;
    case "partial_write":
      return `The PTY write stopped after ${written}.`;
    case "write_failed":
      return "The PTY write made no progress.";
    case "cancelled":
      return `The operation was cancelled; ${written}.`;
    default:
      return `Terminal reported ${outcome} for the ${kind} operation.`;
  }
}

function historyUnavailableLabel(reason: HistoryUnavailableReasonName): string {
  switch (reason) {
    case "evicted":
      return "history evicted";
    case "restart":
      return "hub restarted";
    case "oversize":
      return "history oversize";
    case "capture_failed":
      return "capture failed";
  }
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

export function createHubTerminalDataPlane(options: HubTerminalDataPlaneOptions): TerminalDataPlaneAttachment {
  return new HubTerminalDataPlane(options);
}

function sameUnsafePasteConsent(left: UnsafePasteConsent, right: UnsafePasteConsent): boolean {
  return (
    left.attachmentGeneration === right.attachmentGeneration &&
    left.rejectedOperationId === right.rejectedOperationId &&
    left.expiresAt === right.expiresAt
  );
}

function createTerminalSubscriptionId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) {
    return `${hubTerminalSubscriptionId}-${randomId}`;
  }
  return `${hubTerminalSubscriptionId}-${Date.now()}-${nextSubscriptionSequence++}`;
}

type LiveHarness = {
  events?: Array<{ kind: string; payload: unknown }>;
  terminal?: Array<{ kind: string; payload: unknown }>;
  decodeTerminalBody?: typeof decodeTerminalBody;
};

function liveHarness(): LiveHarness | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & { __BOTSTER_LIVE_PROTOCOL_HARNESS__?: LiveHarness }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
}

function liveHarnessTerminalRecorderInstalled(): boolean {
  return Boolean(liveHarness()?.terminal);
}

/** Records only when an operator harness installed its terminal recorder; no payload copies otherwise. */
function recordLiveHarnessTerminal(kind: string, payload: unknown): void {
  liveHarness()?.terminal?.push({ kind, payload });
}

/**
 * One decoded route frame for the operator harness event log. Payload bytes are copied as
 * base64 only when the harness event recorder exists; production has no recorder.
 */
function recordLiveHarnessRouteFrame(frame: TerminalRouteFrame, decoded: TerminalEvent): void {
  const events = liveHarness()?.events;
  if (!events) return;
  const summary: Record<string, unknown> = { kind: decoded.kind };
  switch (decoded.kind) {
    case "output":
    case "snapshot_ready":
    case "snapshot_history":
      summary.bytes = decoded.payload.byteLength;
      summary.payload_base64 = bytesToBase64(decoded.payload);
      break;
    case "process_exit":
      summary.code = decoded.code;
      break;
    case "modes":
      summary.mode_bits = decoded.mode_bits;
      summary.rows = decoded.rows;
      summary.cols = decoded.cols;
      break;
    case "attach_state":
      summary.state = decoded.state;
      break;
    case "input_result":
      summary.operation_id = Number(decoded.result.operation_id);
      summary.outcome = decoded.result.outcome;
      summary.accepted_payload_bytes = decoded.result.accepted_payload_bytes === null ? null : Number(decoded.result.accepted_payload_bytes);
      summary.written_pty_bytes = decoded.result.written_pty_bytes === null ? null : Number(decoded.result.written_pty_bytes);
      summary.mode_bits = decoded.result.mode_bits;
      summary.detail = decoded.result.detail;
      break;
    case "history_unavailable":
      summary.reason = decoded.reason;
      break;
    case "route_resync":
      summary.from_epoch = decoded.from_epoch;
      summary.to_epoch = decoded.to_epoch;
      break;
    case "snapshot_finish":
      break;
  }
  events.push({
    kind: "terminal_route_frame",
    payload: { route: frame.route, generation: frame.generation, stream_epoch: frame.streamEpoch, frame: summary }
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    for (const value of bytes) binary += String.fromCharCode(value);
    return globalThis.btoa(binary);
  }
  const buffer = (globalThis as { Buffer?: { from(data: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (buffer) return buffer.from(bytes).toString("base64");
  throw new Error("No base64 encoder is available in this runtime.");
}
