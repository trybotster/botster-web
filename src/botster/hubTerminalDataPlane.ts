import type {
  ModeDependentTerminalInput,
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalOutput,
  TerminalSnapshotReader,
  TerminalSubscription
} from "./terminal";
import type {
  DaemonBridgeClient,
  DaemonTerminalStreamSubscription,
  TerminalStreamEvent
} from "./hubTransport";
import { hubTerminalSubscriptionId } from "./hubTransport";
import type {
  DaemonCaptureSnapshot,
  DaemonModeFlags,
  DaemonModeGatedInputResult,
  DaemonReadScreen
} from "./realHubDaemonDto";
import {
  webRtcDaemonLifecycleEventName,
  type WebrtcDaemonLifecycleEvent
} from "./webrtcDaemonClient";

const maxHydrationBufferBytes = 16_777_216;
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
  bufferedOutput: Uint8Array[];
  bufferedBytes: number;
  pendingExit?: number | null;
  readyReceived: boolean;
  finishReceived: boolean;
  historyIncomplete: boolean;
  attachedReceived: boolean;
  completed: boolean;
  reader?: TerminalSnapshotReader;
  resolveBarrier(): void;
  barrier: Promise<void>;
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

  private subscriptionId: string;
  private readonly fixedSubscriptionId: boolean;
  private readonly testHooks: HubTerminalDataPlaneTestHooks | undefined;
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private readonly statusListeners = new Set<(status: TerminalAttachmentStatus) => void>();
  private currentStatus: TerminalAttachmentStatus = {
    state: "attaching",
    message: "Attaching terminal stream."
  };
  private streamSubscription: DaemonTerminalStreamSubscription | undefined;
  private attachPromise: Promise<void> | undefined;
  private pendingResize: { rows: number; columns: number } | undefined;
  private detached = false;
  private transportLost = false;
  private attachmentGeneration = 0;
  private hydration: ScreenHydration | undefined;
  private restoredVisibleScreenGeneration: number | undefined;
  private modeFlags: DaemonModeFlags | undefined;
  private incrementalSnapshotReaderFactory: (() => TerminalSnapshotReader) | undefined;
  private terminalEventQueue: Promise<void> = Promise.resolve();
  private terminalInputQueue: Promise<void> = Promise.resolve();
  private snapshotRecoveries = 0;
  private readonly onWebrtcLifecycle?: (event: Event) => void;

  constructor(private readonly options: HubTerminalDataPlaneOptions) {
    if (!options.sessionId) throw new Error("Hub terminal data plane requires a session id.");
    this.sessionId = options.sessionId;
    this.fixedSubscriptionId = Boolean(options.subscriptionId);
    this.subscriptionId = options.subscriptionId ?? createTerminalSubscriptionId();
    this.testHooks = options.testHooks;
    // Surviving-document DataChannel recovery must mint a fresh terminal subscription
    // and re-run H0–H5 without unmounting the renderer. Wait for encrypted-stream-ready
    // so attach RPCs are not issued against a half-open peer.
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      this.onWebrtcLifecycle = (event: Event) => {
        const detail = (event as CustomEvent<WebrtcDaemonLifecycleEvent>).detail;
        if (!detail?.type) return;
        if (detail.type === "data-channel-closed" || detail.type === "data-channel-error") {
          this.handleTransportLost();
        } else if (detail.type === "encrypted-stream-ready") {
          // Wait for HelloAck, not only the first encrypted send.
          this.handleTransportRecovered();
        }
      };
      window.addEventListener(webRtcDaemonLifecycleEventName, this.onWebrtcLifecycle);
      registerTerminalTransportRecoveryPlane(this);
    }
  }

  /** Test/live harness: stop listening for WebRTC recovery (reconnect-listener ablation). */
  disableTransportRecovery(): void {
    this.uninstallLifecycleListener();
    unregisterTerminalTransportRecoveryPlane(this);
  }

  bindIncrementalSnapshotReader(createReader: () => TerminalSnapshotReader): void {
    this.incrementalSnapshotReaderFactory = createReader;
  }

  writeInput(data: string): Promise<void> {
    recordLiveHarnessTerminal("input", { data, path: "send_input" });
    return this.enqueueTerminalInput(async (attachmentGeneration) => {
      await this.options.bridge.request({
        type: "send_input",
        session_id: this.sessionId,
        data
      });
      if (!this.isCurrentAttachment(attachmentGeneration)) return;
    });
  }

  writeModeGatedInput(semantic: ModeDependentTerminalInput): Promise<void> {
    return this.enqueueTerminalInput((attachmentGeneration) =>
      this.writeModeGatedInputAfterBarrier(semantic, attachmentGeneration)
    );
  }

  private async writeModeGatedInputAfterBarrier(
    semantic: ModeDependentTerminalInput,
    attachmentGeneration: number
  ): Promise<void> {
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

    // Producer must emit JSON-safe mode tokens (≤ 2^53-1). Core ticket_1786517156_512585 /
    // botster-core#121 bounds session-worker generations. Fail closed if a non-safe token
    // still arrives so we never silently admit via send_input.
    if (!isJsonSafeModeToken(modes)) {
      recordLiveHarnessTerminal("mode_gated_input_failed", {
        reason: "unsafe_json_integer_token",
        mode_generation: modes.mode_generation,
        mode_revision: modes.mode_revision
      });
      throw new Error(
        `Mode freshness token is not JSON-safe (generation=${modes.mode_generation}, revision=${modes.mode_revision}); browser ModeGatedInput requires tokens ≤ 2^53-1.`
      );
    }

    // First encode under current authoritative modes.
    let encoded = semantic.encode(modes);
    // Empty encode may mean modes disabled the event (mouse_mode=0) — but cached
    // mode flags can be stale if the session later enabled mouse. Refresh once
    // before treating empty as authoritative discard.
    if (!encoded) {
      const refreshed = await this.refreshModeFlags(attachmentGeneration);
      if (!refreshed || !this.isCurrentAttachment(attachmentGeneration)) return;
      this.modeFlags = refreshed;
      modes = refreshed;
      if (!isJsonSafeModeToken(modes)) {
        recordLiveHarnessTerminal("mode_gated_input_failed", {
          reason: "unsafe_json_integer_token_after_refresh",
          mode_generation: modes.mode_generation,
          mode_revision: modes.mode_revision
        });
        throw new Error(
          `Mode freshness token is not JSON-safe (generation=${modes.mode_generation}, revision=${modes.mode_revision}); browser ModeGatedInput requires tokens ≤ 2^53-1.`
        );
      }
      encoded = semantic.encode(modes);
      if (!encoded) {
        recordLiveHarnessTerminal("mode_gated_input_skipped", {
          reason: "encode_empty_after_mode_refresh",
          mode_generation: modes.mode_generation,
          mode_revision: modes.mode_revision,
          mouse_mode: modes.mouse_mode
        });
        return;
      }
      recordLiveHarnessTerminal("mode_flags_refreshed_for_encode", {
        mode_generation: modes.mode_generation,
        mode_revision: modes.mode_revision,
        mouse_mode: modes.mouse_mode
      });
    }
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
    // Stale → fresh modes may disable the semantic event (e.g. mouse 9 → 0).
    if (!reencoded) {
      recordLiveHarnessTerminal("mode_gated_input_skipped", {
        reason: "reencode_empty_under_fresh_modes",
        discarded_bytes: encoded,
        mode_generation: freshModes.mode_generation,
        mode_revision: freshModes.mode_revision,
        mouse_mode: freshModes.mouse_mode
      });
      return;
    }
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

  async resize(rows: number, columns: number): Promise<void> {
    recordLiveHarnessTerminal("resize", { rows, columns });
    this.pendingResize = { rows, columns };
    await this.ensureAttached();
    const hydration = this.hydration;
    if (hydration?.completed) {
      await this.flushPendingResizeBestEffort(hydration.generation);
    }
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
    if (this.detached) return;
    this.detached = true;
    this.transportLost = false;
    if (liveHarness()?.ablateCancelDetach === true) {
      recordLiveHarnessTerminal("cancel_detach_ablated", {
        sessionId: this.sessionId,
        subscription_id: this.subscriptionId
      });
      this.listeners.clear();
      this.statusListeners.clear();
      this.uninstallLifecycleListener();
      return;
    }
    this.closeStreamWithoutDetachRequest();
    this.listeners.clear();
    this.statusListeners.clear();
    this.uninstallLifecycleListener();

    await this.options.bridge.request({
      type: "detach",
      session_id: this.sessionId,
      subscription_id: this.subscriptionId
    });
  }

  private uninstallLifecycleListener(): void {
    if (this.onWebrtcLifecycle && typeof window !== "undefined") {
      window.removeEventListener(webRtcDaemonLifecycleEventName, this.onWebrtcLifecycle);
    }
    unregisterTerminalTransportRecoveryPlane(this);
  }

  /**
   * DataChannel lost: abandon the current stream/subscription generation but keep
   * mounted listeners so recovery can re-attach without unmounting the renderer.
   */
  private handleTransportLost(): void {
    if (this.detached) return;
    this.transportLost = true;
    const previousSubscriptionId = this.subscriptionId;
    this.closeStreamWithoutDetachRequest();
    this.emitStatus({
      state: "attaching",
      message: "WebRTC data channel lost; waiting to reattach terminal stream."
    });
    recordLiveHarnessTerminal("transport_lost", {
      sessionId: this.sessionId,
      subscription_id: previousSubscriptionId
    });
  }

  /**
   * DataChannel recovered on a surviving document: mint a fresh subscription id and
   * re-run H0–H5 attach for the still-mounted view.
   */
  private handleTransportRecovered(): void {
    if (this.detached || !this.transportLost || this.listeners.size === 0) return;
    // Only reattach once the encrypted stream is usable. data-channel-open may fire first;
    // keep transportLost until encrypted-stream-ready (or a later open after crypto is up).
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
      // Best-effort detach of the abandoned subscription now that the channel is alive.
      if (previousSubscriptionId && previousSubscriptionId !== this.subscriptionId) {
        try {
          await this.options.bridge.request({
            type: "detach",
            session_id: this.sessionId,
            subscription_id: previousSubscriptionId
          });
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

  private closeStreamWithoutDetachRequest(): void {
    // Drop the local stream handle without a detach RPC on a dead channel.
    // Prefer typed abandon(); fall back to unsubscribe with explicit rejection capture
    // for older test bridges that only implement unsubscribe.
    const sub = this.streamSubscription;
    if (sub) {
      if (typeof sub.abandon === "function") {
        sub.abandon();
      } else {
        try {
          sub.unsubscribe();
        } catch (unsubscribeError: unknown) {
          recordLiveHarnessTerminal("stream_unsubscribe_error", {
            message:
              unsubscribeError instanceof Error ? unsubscribeError.message : String(unsubscribeError)
          });
        }
      }
    }
    this.streamSubscription = undefined;
    this.attachPromise = undefined;
    this.attachmentGeneration += 1;
    if (this.hydration?.reader) {
      recordLiveHarnessTerminal("reader_cancel", {
        generation: this.hydration.generation,
        subscription_id: this.subscriptionId,
        sessionId: this.sessionId
      });
      this.hydration.reader.cancel();
    }
    this.hydration?.resolveBarrier();
    this.hydration = undefined;
    this.terminalEventQueue = Promise.resolve();
    this.terminalInputQueue = Promise.resolve();
    this.restoredVisibleScreenGeneration = undefined;
    this.modeFlags = undefined;
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

    this.ensureHydration(attachmentGeneration);
    const streamSubscription = this.options.bridge.streamTerminal(
      this.sessionId,
      this.subscriptionId,
      (event) => this.enqueueTerminalEvent(event, attachmentGeneration)
    );
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      streamSubscription.unsubscribe();
      return;
    }
    this.streamSubscription = streamSubscription;
    recordLiveHarnessTerminal("attach", {
      attempt: 1,
      generation: attachmentGeneration,
      subscription_id: this.subscriptionId,
      sessionId: this.sessionId
    });
    if (streamSubscription.ready) {
      await streamSubscription.ready;
      if (!this.isCurrentAttachment(attachmentGeneration)) return;
    }
  }

  private enqueueTerminalInput(
    send: (attachmentGeneration: number) => Promise<void>
  ): Promise<void> {
    const queued = this.terminalInputQueue.then(async () => {
      await this.ensureAttached();
      const hydration = this.hydration;
      if (!hydration) return;
      const attachmentGeneration = hydration.generation;
      await hydration.barrier;
      if (!this.isCurrentAttachment(attachmentGeneration) || !hydration.completed) return;
      await send(attachmentGeneration);
    });
    this.terminalInputQueue = queued.catch(() => undefined);
    return queued;
  }

  private enqueueTerminalEvent(event: TerminalStreamEvent, attachmentGeneration: number): Promise<void> {
    const delivery = this.terminalEventQueue.then(() =>
      this.emitTerminalEvent(event, attachmentGeneration)
    );
    this.terminalEventQueue = delivery.catch((error: unknown) => {
      recordLiveHarnessTerminal("event_delivery_failed", {
        message: error instanceof Error ? error.message : String(error),
        generation: attachmentGeneration,
        subscription_id: this.subscriptionId
      });
    });
    return delivery;
  }

  private closeStream(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = undefined;
    this.attachPromise = undefined;
    this.attachmentGeneration += 1;
    if (this.hydration?.reader) {
      recordLiveHarnessTerminal("reader_cancel", {
        generation: this.hydration.generation,
        subscription_id: this.subscriptionId,
        sessionId: this.sessionId
      });
      this.hydration.reader.cancel();
    }
    this.hydration?.resolveBarrier();
    this.hydration = undefined;
    this.terminalEventQueue = Promise.resolve();
    this.terminalInputQueue = Promise.resolve();
    this.restoredVisibleScreenGeneration = undefined;
    this.modeFlags = undefined;
  }

  private async flushPendingResize(attachmentGeneration: number): Promise<void> {
    if (!this.streamSubscription || !this.pendingResize) return;

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

  private async flushPendingResizeBestEffort(attachmentGeneration: number): Promise<void> {
    try {
      await this.flushPendingResize(attachmentGeneration);
    } catch (error: unknown) {
      recordLiveHarnessTerminal("resize_after_finish_failed", {
        message: error instanceof Error ? error.message : String(error),
        generation: attachmentGeneration
      });
    }
  }

  private async emitTerminalEvent(event: TerminalStreamEvent, attachmentGeneration: number): Promise<void> {
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return;
    }

    if (event.session_id !== this.sessionId || event.subscription_id !== this.subscriptionId) {
      return;
    }

    await this.testHooks?.beforeListenerDelivery?.();
    if (!this.isCurrentAttachment(attachmentGeneration)) {
      return;
    }

    if (event.type === "terminal_subscription_closed") {
      recordLiveHarnessTerminal("terminal_subscription_closed", {
        reason: event.reason,
        generation: event.generation,
        subscription_id: event.subscription_id
      });
      if (event.reason === "core_adapter_closed") {
        this.hydration?.reader?.cancel();
        this.emitStatus({
          state: "failed",
          message: "Terminal subscription closed by Core write-budget."
        });
        this.closeStream();
      }
      return;
    }

    if (event.type === "attach_state") {
      const hydration = this.ensureHydration(attachmentGeneration);
      if (event.state === "snapshot_history_incomplete") {
        if (!hydration.readyReceived) {
          this.failHydration(hydration, "Terminal snapshot history failed before READY.");
          return;
        }
        hydration.historyIncomplete = true;
        hydration.finishReceived = true;
        hydration.reader?.cancel();
        this.emitStatus({
          state: "attaching",
          message: "Terminal screen is ready with incomplete snapshot history."
        });
        await this.completeIncrementalHydration(hydration);
      } else if (event.state === "attached") {
        hydration.attachedReceived = true;
        await this.completeIncrementalHydration(hydration);
      } else if (event.state === "attach_failed") {
        if (!hydration.readyReceived) {
          this.recoverLostSnapshot(hydration, "Terminal attach failed before READY.");
          return;
        }
        this.failHydration(hydration, "Terminal attach failed after READY.");
      } else {
        this.emitStatus(attachStateStatus(event.state));
      }
      recordLiveHarnessTerminal("attach_state", { state: event.state });
      return;
    }

    if (event.type === "process_exit") {
      const code = event.code ?? null;
      if (this.hydration?.generation === attachmentGeneration && !this.hydration.completed) {
        this.hydration.pendingExit = code;
        return;
      }
      this.emitProcessExit(code);
      return;
    }

    if (event.type === "snapshot") {
      recordLiveHarnessTerminal("snapshot", {
        bytes: event.bytes,
        payload_encoding: event.payload_encoding,
        phase: event.phase
      });
      const hydration = this.ensureHydration(attachmentGeneration);
      try {
        const snapshotBytes = decodeDaemonByteEnvelope(
          event.payload_base64,
          event.payload_encoding,
          event.bytes
        );
        await this.installIncrementalSnapshotFrame(hydration, snapshotBytes);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Invalid terminal snapshot payload.";
        if (isLostSnapshotProgress(message)) {
          this.recoverLostSnapshot(hydration, message);
          return;
        }
        this.failHydration(hydration, message);
      }
      return;
    }

    if (event.type === "terminal_output") {
      let outputBytes: Uint8Array;
      try {
        outputBytes = decodeTerminalOutputEvent(event);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Invalid terminal output payload.";
        if (this.hydration?.generation === attachmentGeneration && !this.hydration.completed) {
          this.failHydration(this.hydration, message);
          return;
        }
        this.emitStatus({
          state: "failed",
          message
        });
        recordLiveHarnessTerminal("output_decode_failed", { message });
        return;
      }
      if (this.hydration?.generation === attachmentGeneration && !this.hydration.completed) {
        this.bufferHydratingOutput(outputBytes, this.hydration);
        return;
      }
      if (
        this.currentStatus.state === "attaching" ||
        (this.currentStatus.state === "attached" && this.restoredVisibleScreenGeneration !== attachmentGeneration)
      ) {
        this.emitStatus({
          state: "live_only",
          message: "Terminal stream attached live; no snapshot was restored."
        });
      }
      this.emitOutput(outputBytes, "output");
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
      finishReceived: false,
      historyIncomplete: false,
      attachedReceived: false,
      completed: false,
      reader: this.incrementalSnapshotReaderFactory?.(),
      resolveBarrier: () => undefined,
      barrier: Promise.resolve()
    };
    hydration.barrier = new Promise<void>((resolve) => {
      hydration.resolveBarrier = resolve;
    });
    this.hydration = hydration;
    return hydration;
  }

  private async installIncrementalSnapshotFrame(
    hydration: ScreenHydration,
    bytes: Uint8Array
  ): Promise<void> {
    const attachmentGeneration = hydration.generation;
    await this.testHooks?.beforeSnapshotInstall?.();
    await holdLiveSnapshotInstallIfArmed(attachmentGeneration, this.subscriptionId);
    if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) return;

    const reader = hydration.reader;
    if (!reader) {
      throw new Error("Restty incremental snapshot reader is not bound.");
    }
    const progress = await reader.read(bytes);
    if (!this.isCurrentAttachment(attachmentGeneration) || this.hydration !== hydration) return;

    if (progress === "ready") {
      if (hydration.readyReceived || hydration.finishReceived) {
        throw new Error("Restty returned READY outside the initial snapshot frame.");
      }
      hydration.readyReceived = true;
      this.restoredVisibleScreenGeneration = attachmentGeneration;
      this.emitStatus({
        state: "attaching",
        message: "Visible terminal screen restored at snapshot READY; loading history."
      });
    } else if (progress === "page") {
      if (!hydration.readyReceived || hydration.finishReceived) {
        throw new Error("Restty returned PAGE outside snapshot history delivery.");
      }
    } else if (progress === "finish") {
      if (!hydration.readyReceived || hydration.finishReceived) {
        throw new Error("Restty returned FINISH outside snapshot history delivery.");
      }
      hydration.finishReceived = true;
    } else {
      throw new Error(`Restty returned unknown snapshot progress: ${String(progress)}.`);
    }

    recordLiveHarnessTerminal("ghostsnp_install", {
      bytes: bytes.byteLength,
      generation: attachmentGeneration,
      progress,
      subscription_id: this.subscriptionId
    });

    if (hydration.attachedReceived) {
      await this.completeIncrementalHydration(hydration);
    }
  }

  private async completeIncrementalHydration(hydration: ScreenHydration): Promise<void> {
    const attachmentGeneration = hydration.generation;
    if (hydration.completed) return;
    if (!hydration.attachedReceived) return;
    if (!hydration.readyReceived) {
      this.failHydration(hydration, "Terminal attached before snapshot READY.");
      return;
    }
    if (!hydration.finishReceived && !hydration.historyIncomplete) {
      this.failHydration(hydration, "Terminal attached before snapshot FINISH.");
      return;
    }

    hydration.completed = true;
    this.emitStatus({
      state: "attached",
      message: hydration.historyIncomplete
        ? "Terminal attached with incomplete snapshot history."
        : "Terminal attached after incremental snapshot history."
    });
    hydration.resolveBarrier();

    for (const data of hydration.bufferedOutput) {
      if (!this.isCurrentAttachment(attachmentGeneration)) {
        return;
      }
      this.emitOutput(data, "output");
    }
    if (hydration.pendingExit !== undefined) {
      this.emitProcessExit(hydration.pendingExit);
    }

    // Host RPCs after adapter bind can stall. Do not hold attached on them.
    void this.refreshModeFlags(attachmentGeneration).then((modes) => {
      if (modes && this.isCurrentAttachment(attachmentGeneration) && this.hydration === hydration) {
        this.modeFlags = modes;
      }
    });
    void this.flushPendingResizeBestEffort(attachmentGeneration);
    void this.options.bridge
      .request({
        type: "read_screen",
        session_id: this.sessionId
      })
      .then((response) => {
        if (this.isCurrentAttachment(attachmentGeneration) && this.hydration === hydration) {
          const text = response.read_screen?.text;
          recordLiveHarnessTerminal("read_screen_supplement", {
            text: typeof text === "string" ? text : null
          });
        }
      })
      .catch(() => {
        // ReadScreen is an optional diagnostic supplement.
      });
  }

  private failHydration(hydration: ScreenHydration, message: string): void {
    if (this.hydration !== hydration) return;
    hydration.completed = true;
    hydration.resolveBarrier();
    this.emitStatus({
      state: "failed",
      message
    });
    recordLiveHarnessTerminal("ghostsnp_hydrate_failed", { message });
    this.closeStream();
  }

  private recoverLostSnapshot(hydration: ScreenHydration, message: string): void {
    if (this.hydration !== hydration) return;
    if (this.snapshotRecoveries >= 1 || this.fixedSubscriptionId) {
      this.failHydration(hydration, message);
      return;
    }
    this.snapshotRecoveries += 1;
    const previousSubscriptionId = this.subscriptionId;
    recordLiveHarnessTerminal("snapshot_lost_recover", {
      message,
      previous_subscription_id: previousSubscriptionId
    });
    hydration.reader?.cancel();
    this.closeStream();
    this.subscriptionId = createTerminalSubscriptionId();
    this.emitStatus({
      state: "attaching",
      message: "Lost snapshot page; starting a fresh attach."
    });
    void this.ensureAttached().catch((error: unknown) => {
      this.emitStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Fresh terminal attach failed."
      });
    });
  }

  private bufferHydratingOutput(data: Uint8Array, hydration: ScreenHydration): void {
    const bufferedBytes = hydration.bufferedBytes + data.byteLength;
    if (bufferedBytes > maxHydrationBufferBytes) {
      this.failHydration(hydration, "Terminal snapshot attach exceeded the live-output buffer limit.");
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

  private emitOutput(data: TerminalOutput, kind: "output"): void {
    for (const listener of this.listeners) {
      listener(data);
    }
    recordLiveHarnessTerminal("output", {
      payload_bytes_base64: bytesToBase64(data),
      bytes: data.byteLength,
      source: kind
    });
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

export function decodeDaemonByteEnvelope(
  payloadBase64: string,
  payloadEncoding: unknown,
  declaredBytes: unknown
): Uint8Array {
  if (payloadEncoding !== "base64") {
    throw new Error(`Unsupported payload encoding: ${String(payloadEncoding)}.`);
  }
  if (typeof payloadBase64 !== "string") {
    throw new Error("payload_base64 is required.");
  }
  if (typeof declaredBytes !== "number" || !Number.isInteger(declaredBytes) || declaredBytes < 0) {
    throw new Error("bytes must be a non-negative integer.");
  }
  if (payloadBase64.length % 4 !== 0 || (payloadBase64.length > 0 && !/^[A-Za-z0-9+/]+={0,2}$/.test(payloadBase64))) {
    throw new Error("Invalid base64 payload.");
  }
  const bytes = base64ToBytes(payloadBase64);
  if (bytes.byteLength !== declaredBytes) {
    throw new Error(
      `Payload length ${bytes.byteLength} does not match declared bytes ${declaredBytes}.`
    );
  }
  return bytes;
}

export function decodeTerminalOutputEvent(event: object): Uint8Array {
  if ("data" in event) {
    throw new Error("Terminal output event includes retired data field.");
  }
  const record = event as {
    payload_base64?: string;
    payload_encoding?: unknown;
    bytes?: unknown;
  };
  return decodeDaemonByteEnvelope(record.payload_base64 ?? "", record.payload_encoding, record.bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
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

function isLostSnapshotProgress(message: string): boolean {
  return (
    message.includes("unknown snapshot progress") ||
    message.includes("PAGE outside snapshot history") ||
    message.includes("READY outside the initial snapshot frame") ||
    message.includes("FINISH outside snapshot history") ||
    message.includes("Invalid terminal snapshot payload")
  );
}

function attachStateStatus(state: string): TerminalAttachmentStatus {
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

const terminalTransportRecoveryPlanes = new Set<HubTerminalDataPlane>();

function registerTerminalTransportRecoveryPlane(plane: HubTerminalDataPlane): void {
  terminalTransportRecoveryPlanes.add(plane);
  installTerminalTransportRecoveryHarnessHook();
}

function unregisterTerminalTransportRecoveryPlane(plane: HubTerminalDataPlane): void {
  terminalTransportRecoveryPlanes.delete(plane);
}

function installTerminalTransportRecoveryHarnessHook(): void {
  if (typeof window === "undefined") return;
  const harness = liveHarness();
  if (!harness) return;
  harness.disableTerminalTransportRecovery = () => {
    for (const plane of [...terminalTransportRecoveryPlanes]) {
      plane.disableTransportRecovery();
    }
  };
  harness.armSnapshotInstallHold = () => {
    harness.snapshotInstallHoldArmed = true;
  };
  harness.releaseSnapshotInstall = () => {
    snapshotInstallHoldRelease?.();
    snapshotInstallHoldRelease = undefined;
  };
}

type LiveTerminalHarness = {
  disableTerminalTransportRecovery?: () => void;
  armSnapshotInstallHold?: () => void;
  releaseSnapshotInstall?: () => void;
  snapshotInstallHoldArmed?: boolean;
  ablateCancelDetach?: boolean;
  terminal?: Array<{ kind: string; payload: unknown }>;
};

function liveHarness(): LiveTerminalHarness | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: LiveTerminalHarness;
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
}

let snapshotInstallHoldRelease: (() => void) | undefined;

function holdLiveSnapshotInstallIfArmed(
  generation: number,
  subscriptionId: string
): Promise<void> {
  const harness = liveHarness();
  if (!harness?.snapshotInstallHoldArmed) return Promise.resolve();
  harness.snapshotInstallHoldArmed = false;
  recordLiveHarnessTerminal("snapshot_install_held", {
    generation,
    subscription_id: subscriptionId
  });
  return new Promise((resolve) => {
    snapshotInstallHoldRelease = resolve;
    harness.releaseSnapshotInstall = () => {
      snapshotInstallHoldRelease?.();
      snapshotInstallHoldRelease = undefined;
    };
  });
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
