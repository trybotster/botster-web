import type {
  AesGcmEnvelope,
  DaemonBridgeRequestEnvelope,
  DaemonBridgeResponseEnvelope,
  DaemonEntityFrame,
  DaemonEvent,
  DaemonLocalWebrtcBootstrap,
  DaemonLocalWebrtcDeliveryChunk,
  DaemonLocalWebrtcDeliveryKind,
  DaemonRequest,
  DaemonResponse,
  JsonValue
} from "./realHubDaemonDto";
import type { DaemonBridgeClient } from "./realHubDogfoodTransport";

export interface LocalWebrtcBootstrap extends DaemonLocalWebrtcBootstrap {
  signaling_url: string;
}

export interface WebrtcDaemonClientOptions {
  bootstrap: LocalWebrtcBootstrap;
  fetchImpl?: typeof fetch;
  refreshBootstrap?: () => Promise<LocalWebrtcBootstrap | undefined>;
  peerConnectionFactory?: () => RTCPeerConnection;
  onLifecycle?: (event: WebrtcDaemonLifecycleEvent) => void;
  entitySubscriptionIdGenerator?: (entityType: string, generation: number) => string;
}

export interface LocalWebrtcBootstrapRefreshOptions {
  bootstrap: LocalWebrtcBootstrap;
  signalingUrl: string;
  fetchImpl?: typeof fetch;
  requestIdGenerator?: () => string;
}

export type WebrtcDaemonLifecycleEvent =
  | { type: "data-channel-open" }
  | { type: "data-channel-closed" }
  | { type: "data-channel-error" }
  | { type: "encrypted-stream-ready"; requestType: string };

export const webRtcDaemonLifecycleEventName = "botster:webrtc-daemon-lifecycle";

type PendingRequest = {
  generation: number;
  requestType: string;
  messageId?: string;
  resolve(response: DaemonResponse): void;
  reject(error: unknown): void;
};

type ResponseAssembly = {
  generation: number;
  deliveryKind: DaemonLocalWebrtcDeliveryKind;
  pending?: PendingRequest;
  chunkCount: number;
  totalBytes: number;
  chunks: Map<number, string>;
  receivedBytes: number;
  retainedBytes: number;
  startedAt: number;
  timeout: number;
};

type EntitySubscription = {
  entityType: string;
  listener(frame: DaemonEntityFrame): void;
  generation?: number;
  subscriptionId?: string;
  snapshotSeq?: number;
  ready?: Promise<void>;
  resolveReady?: () => void;
  rejectReady?: (error: unknown) => void;
  resubscribing: boolean;
  closed: boolean;
};

export type WebrtcDaemonFailureStage = "bootstrap" | "signaling" | "transport" | "encryption" | "data-plane";

export class WebrtcDaemonClientError extends Error {
  readonly botsterWebrtcStage: WebrtcDaemonFailureStage;

  constructor(stage: WebrtcDaemonFailureStage, message: string) {
    super(message);
    this.name = "WebrtcDaemonClientError";
    this.botsterWebrtcStage = stage;
  }
}

export const localWebrtcResponseChunkLimits = Object.freeze({
  maximumFrameBytesExclusive: 65_536,
  maximumResponseBytes: 16_777_216,
  maximumAggregateRetainedBytes: 32 * 1_024 * 1_024,
  maximumConcurrentAssemblies: 16,
  maximumCompletedMessageIds: 64,
  requestTimeoutMs: 10_000,
  assemblyBookkeepingBytes: 256,
  chunkBookkeepingBytes: 64,
  completedMessageBookkeepingBytes: 64
});

const requestTimeoutMs = localWebrtcResponseChunkLimits.requestTimeoutMs;
const drainIntervalMs = 25;

function createRequestIdGenerator(prefix: string) {
  let counter = 0;
  return () => `${prefix}-${++counter}`;
}

export function createLocalWebrtcBootstrapRefresher({
  bootstrap,
  signalingUrl,
  fetchImpl = fetch,
  requestIdGenerator = createRequestIdGenerator("local-webrtc-bootstrap")
}: LocalWebrtcBootstrapRefreshOptions): () => Promise<LocalWebrtcBootstrap | undefined> {
  return async () => {
    const request: DaemonRequest = {
      type: "issue_local_webrtc_bootstrap",
      package_name: bootstrap.package_name,
      entrypoint_id: bootstrap.entrypoint_id,
      origin: new URL(signalingUrl, window.location.href).origin
    };
    recordLiveHarnessEvent("daemon_request", request);
    const envelope: DaemonBridgeRequestEnvelope = {
      kind: "daemon_request",
      request_id: requestIdGenerator(),
      payload: request
    };
    const response = await fetchImpl(signalingUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope)
    });
    if (!response.ok) {
      throw webrtcFailure("bootstrap", `local WebRTC bootstrap refresh failed with HTTP ${response.status}`);
    }

    const reply = (await response.json()) as DaemonBridgeResponseEnvelope;
    if (reply.kind !== "daemon_response") {
      throw webrtcFailure("bootstrap", "local WebRTC bootstrap refresh returned an unexpected transport envelope");
    }
    recordLiveHarnessEvent("daemon_response", reply.payload);
    return reply.payload.local_webrtc_bootstrap
      ? { ...reply.payload.local_webrtc_bootstrap, signaling_url: bootstrap.signaling_url }
      : undefined;
  };
}

export function createWebrtcDaemonClient(options: WebrtcDaemonClientOptions): DaemonBridgeClient {
  const transport = new WebrtcDaemonTransport(options);
  const eventListeners = new Set<(event: DaemonEvent) => void>();

  return {
    async request(request) {
      return transport.request(request);
    },
    disconnect() {
      transport.disconnect();
    },
    subscribeEvents(onEvent) {
      eventListeners.add(onEvent);
      return {
        unsubscribe: () => {
          eventListeners.delete(onEvent);
        }
      };
    },
    subscribeEntityFrames(entityType, onFrame) {
      return transport.subscribeEntityFrames(entityType, onFrame);
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      let closed = false;
      let timer: number | undefined;

      const emitEvents = (response: DaemonResponse) => {
        const events = response.events ?? [];
        for (const event of events) {
          recordLiveHarnessEvent("daemon_event", event);
          eventListeners.forEach((listener) => listener(event));
          onEvent(event);
        }
      };

      const drain = async () => {
        if (closed) return;

        try {
          const response = await transport.request({ type: "drain", session_id: sessionId });
          if (closed) return;
          emitEvents(response);
        } catch (error) {
          recordLiveHarnessEvent("terminal_stream_error", {
            stage: "drain",
            message: error instanceof Error ? error.message : String(error)
          });
          closed = true;
          return;
        }

        if (!closed) {
          timer = window.setTimeout(() => void drain(), drainIntervalMs);
        }
      };

      void transport
        .request({ type: "attach", session_id: sessionId, subscription_id: subscriptionId })
        .then((response) => {
          if (closed) return;
          emitEvents(response);
          void drain();
        })
        .catch((error: unknown) => {
          recordLiveHarnessEvent("terminal_stream_error", {
            stage: "attach",
            message: error instanceof Error ? error.message : String(error)
          });
          closed = true;
        });

      return {
        unsubscribe: () => {
          closed = true;
          if (timer !== undefined) {
            window.clearTimeout(timer);
          }
          void transport.request({ type: "detach", session_id: sessionId, subscription_id: subscriptionId });
        }
      };
    }
  };
}

class WebrtcDaemonTransport {
  private readonly fetchImpl: typeof fetch;
  private readonly peerConnectionFactory: () => RTCPeerConnection;
  private readonly pageHideHandler: (() => void) | undefined;
  private readonly pendingRequests: PendingRequest[] = [];
  private readonly responseAssemblies = new Map<string, ResponseAssembly>();
  private readonly completedMessageIds = new Set<string>();
  private readonly entitySubscriptions = new Set<EntitySubscription>();
  private peerConnection: RTCPeerConnection | undefined;
  private dataChannel: RTCDataChannel | undefined;
  private cryptoKey: CryptoKey | undefined;
  private connectPromise: Promise<void> | undefined;
  private encryptedStreamReady = false;
  private disconnected = false;
  private closing = false;
  private peerGeneration = 0;
  private aggregateRetainedBytes = 0;

  constructor(private readonly options: WebrtcDaemonClientOptions) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.peerConnectionFactory = options.peerConnectionFactory ?? (() => new RTCPeerConnection());
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      this.pageHideHandler = () => this.disconnect();
      window.addEventListener("pagehide", this.pageHideHandler);
    }
  }

  async request(request: DaemonRequest): Promise<DaemonResponse> {
    try {
      await this.connect();
    } catch (error) {
      recordLiveHarnessEvent("webrtc_error", {
        stage: "connect",
        request_type: request.type,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
    const channel = this.dataChannel;
    const key = this.cryptoKey;
    if (!channel || !key || channel.readyState !== "open") {
      throw webrtcFailure("transport", "local WebRTC data channel is not open");
    }

    recordLiveHarnessEvent("daemon_request", request);
    let envelope: AesGcmEnvelope;
    try {
      envelope = await encryptDaemonRequest(key, request);
    } catch (error) {
      throw webrtcFailure("encryption", `local WebRTC request encryption failed: ${errorMessage(error)}`);
    }
    return new Promise<DaemonResponse>((resolve, reject) => {
      const generation = this.peerGeneration;
      const timeout = window.setTimeout(() => {
        this.failPeerGeneration(
          generation,
          webrtcFailure("data-plane", `local WebRTC request timed out: ${request.type}`)
        );
      }, requestTimeoutMs);

      const pending: PendingRequest = {
        generation,
        requestType: request.type,
        resolve: (response) => {
          window.clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      };
      this.pendingRequests.push(pending);

      try {
        channel.send(JSON.stringify(envelope));
        if (!this.encryptedStreamReady) {
          this.encryptedStreamReady = true;
          this.emitLifecycle({ type: "encrypted-stream-ready", requestType: request.type });
        }
      } catch (error) {
        const index = this.pendingRequests.indexOf(pending);
        if (index >= 0) this.pendingRequests.splice(index, 1);
        pending.reject(
          webrtcFailure("data-plane", `local WebRTC data-plane send failed for ${request.type}: ${errorMessage(error)}`)
        );
      }
    });
  }

  subscribeEntityFrames(
    entityType: string,
    listener: (frame: DaemonEntityFrame) => void
  ): { ready: Promise<void>; unsubscribe(): void } {
    const subscription: EntitySubscription = {
      entityType,
      listener,
      resubscribing: false,
      closed: false
    };
    this.entitySubscriptions.add(subscription);
    const ready = this.ensureEntitySubscription(subscription);

    return {
      ready,
      unsubscribe: () => {
        if (subscription.closed) return;
        subscription.closed = true;
        this.entitySubscriptions.delete(subscription);
        const subscriptionId = subscription.subscriptionId;
        if (subscriptionId) {
          void this.request({ type: "unsubscribe_entities", subscription_id: subscriptionId }).catch(() => undefined);
        }
      }
    };
  }

  private connect(): Promise<void> {
    if (this.disconnected) {
      throw webrtcFailure("transport", "local WebRTC transport is disconnected");
    }

    this.connectPromise ??= this.open().catch((error: unknown) => {
      this.resetPeerState();
      throw error;
    });
    return this.connectPromise;
  }

  disconnect(): void {
    this.disconnected = true;
    if (typeof window !== "undefined" && this.pageHideHandler && typeof window.removeEventListener === "function") {
      window.removeEventListener("pagehide", this.pageHideHandler);
    }
    this.resetPeerState();
    this.failPending(webrtcFailure("transport", "local WebRTC transport disconnected"));
  }

  private async open(): Promise<void> {
    this.resetPeerState();
    const bootstrap = await this.resolveBootstrap();
    try {
      this.cryptoKey = await importStreamKey(bootstrap.grant_secret);
    } catch (error) {
      throw webrtcFailure("bootstrap", `local WebRTC bootstrap grant is invalid: ${errorMessage(error)}`);
    }

    let peerConnection: RTCPeerConnection;
    try {
      peerConnection = this.peerConnectionFactory();
    } catch (error) {
      throw webrtcFailure("transport", `local WebRTC peer connection failed: ${errorMessage(error)}`);
    }
    this.peerConnection = peerConnection;
    const generation = ++this.peerGeneration;
    let dataChannel: RTCDataChannel;
    try {
      dataChannel = peerConnection.createDataChannel("botster-daemon", {
        ordered: bootstrap.ordered,
        maxRetransmits: bootstrap.max_retransmits ?? undefined,
        maxPacketLifeTime: bootstrap.max_packet_lifetime_ms ?? undefined
      });
    } catch (error) {
      throw webrtcFailure("transport", `local WebRTC data channel creation failed: ${errorMessage(error)}`);
    }
    this.dataChannel = dataChannel;
    let messageQueue = Promise.resolve();
    dataChannel.addEventListener("message", (event) => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      messageQueue = messageQueue
        .then(() => this.handleMessage(event.data, generation))
        .catch((error: unknown) => this.failPeerGeneration(generation, error));
    });
    dataChannel.addEventListener("open", () => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      recordLiveHarnessEvent("webrtc_data_channel", { state: "open" });
      this.emitLifecycle({ type: "data-channel-open" });
    });
    dataChannel.addEventListener("close", () => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      recordLiveHarnessEvent("webrtc_data_channel", { state: "closed" });
      this.emitLifecycle({ type: "data-channel-closed" });
      this.handleTransportClosed(webrtcFailure("transport", "local WebRTC data channel closed"));
    });
    dataChannel.addEventListener("error", () => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      recordLiveHarnessEvent("webrtc_data_channel", { state: "error" });
      this.emitLifecycle({ type: "data-channel-error" });
      this.handleTransportClosed(webrtcFailure("transport", "local WebRTC data channel failed"));
    });

    let offer: RTCSessionDescriptionInit;
    try {
      offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
    } catch (error) {
      throw webrtcFailure("transport", `local WebRTC offer creation failed: ${errorMessage(error)}`);
    }
    await waitForIceGatheringComplete(peerConnection);

    const signalRequest: DaemonRequest = {
      type: "local_webrtc_signal",
      grant_id: bootstrap.grant_id,
      grant_secret: bootstrap.grant_secret,
      origin: window.location.origin,
      offer: (peerConnection.localDescription?.toJSON?.() ?? peerConnection.localDescription) as unknown as JsonValue
    };
    recordLiveHarnessEvent("daemon_request", signalRequest);

    let response: Response;
    try {
      response = await this.fetchImpl(bootstrap.signaling_url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "daemon_request",
          request_id: `local-webrtc-signal-${Date.now()}`,
          payload: signalRequest
        })
      });
    } catch (error) {
      throw webrtcFailure("signaling", `local WebRTC signaling request failed: ${errorMessage(error)}`);
    }
    if (!response.ok) {
      throw webrtcFailure("signaling", `local WebRTC signaling failed with HTTP ${response.status}`);
    }
    const reply = await response.json() as { payload?: DaemonResponse };
    const answer = reply.payload?.local_webrtc_answer?.answer;
    recordLiveHarnessEvent("webrtc_signal_response", {
      has_answer: Boolean(answer),
      diagnostics: reply.payload?.local_webrtc_answer?.diagnostics ?? reply.payload?.diagnostics ?? [],
      error: reply.payload?.error ?? null
    });
    if (!answer) {
      throw webrtcFailure("signaling", "local WebRTC signaling response did not include an answer");
    }
    try {
      await peerConnection.setRemoteDescription(answer as unknown as RTCSessionDescriptionInit);
      await waitForDataChannelOpen(dataChannel);
    } catch (error) {
      throw webrtcFailure("transport", `local WebRTC transport failed: ${errorMessage(error)}`);
    }
    queueMicrotask(() => {
      for (const subscription of this.entitySubscriptions) {
        void this.startEntitySubscription(subscription, generation);
      }
    });
  }

  private async resolveBootstrap(): Promise<LocalWebrtcBootstrap> {
    if (this.options.refreshBootstrap) {
      try {
        return (await this.options.refreshBootstrap()) ?? this.options.bootstrap;
      } catch (error) {
        recordLiveHarnessEvent("webrtc_error", {
          stage: "bootstrap",
          request_type: "issue_local_webrtc_bootstrap",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return this.options.bootstrap;
  }

  private async handleMessage(data: unknown, generation: number): Promise<void> {
    if (typeof data !== "string") {
      throw webrtcFailure("data-plane", "local WebRTC response chunk frame must be a string");
    }
    if (utf8ByteLength(data) >= localWebrtcResponseChunkLimits.maximumFrameBytesExclusive) {
      throw webrtcFailure("data-plane", "local WebRTC response chunk frame exceeds the transport limit");
    }

    const chunk = parseDeliveryChunk(data);
    if (this.completedMessageIds.has(chunk.message_id)) {
      throw webrtcFailure("data-plane", "local WebRTC response chunk message id was already completed");
    }
    let assembly = this.responseAssemblies.get(chunk.message_id);
    if (!assembly) {
      const pending = chunk.delivery_kind === "daemon_response"
        ? this.pendingRequests.find((entry) => entry.generation === generation && entry.messageId === undefined)
        : undefined;
      if (chunk.delivery_kind === "daemon_response" && !pending) {
        throw webrtcFailure("data-plane", "local WebRTC daemon response chunk has no pending request");
      }
      if (this.responseAssemblies.size >= localWebrtcResponseChunkLimits.maximumConcurrentAssemblies) {
        throw webrtcFailure("data-plane", "local WebRTC response assembly limit exceeded");
      }

      const retainedBytes =
        localWebrtcResponseChunkLimits.assemblyBookkeepingBytes +
        localWebrtcResponseChunkLimits.chunkBookkeepingBytes +
        utf8ByteLength(chunk.payload);
      this.ensureAggregateBudget(retainedBytes);
      if (pending) pending.messageId = chunk.message_id;
      const startedAt = Date.now();
      assembly = {
        generation,
        deliveryKind: chunk.delivery_kind,
        pending,
        chunkCount: chunk.chunk_count,
        totalBytes: chunk.total_bytes,
        chunks: new Map([[chunk.chunk_index, chunk.payload]]),
        receivedBytes: utf8ByteLength(chunk.payload),
        retainedBytes,
        startedAt,
        timeout: window.setTimeout(() => {
          this.failPeerGeneration(
            generation,
            webrtcFailure(
              "data-plane",
              `local WebRTC ${chunk.delivery_kind} assembly timed out${pending ? `: ${pending.requestType}` : ""}`
            )
          );
        }, requestTimeoutMs)
      };
      this.responseAssemblies.set(chunk.message_id, assembly);
      this.aggregateRetainedBytes += retainedBytes;
    } else {
      this.validateAssemblyChunk(assembly, chunk, generation);
      const existingPayload = assembly.chunks.get(chunk.chunk_index);
      if (existingPayload !== undefined) {
        if (existingPayload !== chunk.payload) {
          throw webrtcFailure("data-plane", "local WebRTC response chunk conflicts with a duplicate index");
        }
        return;
      }

      const payloadBytes = utf8ByteLength(chunk.payload);
      const retainedBytes = localWebrtcResponseChunkLimits.chunkBookkeepingBytes + payloadBytes;
      this.ensureAggregateBudget(retainedBytes);
      assembly.chunks.set(chunk.chunk_index, chunk.payload);
      assembly.receivedBytes += payloadBytes;
      assembly.retainedBytes += retainedBytes;
      this.aggregateRetainedBytes += retainedBytes;
    }

    if (assembly.receivedBytes > assembly.totalBytes) {
      throw webrtcFailure("data-plane", "local WebRTC response chunk bytes exceed declared total");
    }
    if (assembly.chunks.size !== assembly.chunkCount) return;
    if (assembly.receivedBytes !== assembly.totalBytes) {
      throw webrtcFailure("data-plane", "local WebRTC response chunk bytes do not match declared total");
    }
    if (assembly.pending && this.pendingRequests[0] !== assembly.pending) {
      throw webrtcFailure("data-plane", "local WebRTC response completed outside pending request order");
    }

    let envelopeJson = "";
    for (let index = 0; index < assembly.chunkCount; index += 1) {
      envelopeJson += assembly.chunks.get(index) as string;
    }
    if (utf8ByteLength(envelopeJson) !== assembly.totalBytes) {
      throw webrtcFailure("data-plane", "local WebRTC response assembly is not byte-exact");
    }

    const key = this.cryptoKey;
    if (!key) throw webrtcFailure("encryption", "local WebRTC response key is unavailable");

    let payload: DaemonResponse | DaemonEntityFrame;
    try {
      payload = await decryptDaemonPayload(key, envelopeJson);
    } catch (error) {
      throw webrtcFailure("encryption", `local WebRTC response decryption failed: ${errorMessage(error)}`);
    }
    if (
      generation !== this.peerGeneration ||
      (assembly.pending && this.pendingRequests[0] !== assembly.pending)
    ) return;
    this.releaseAssembly(chunk.message_id, assembly);
    this.retainCompletedMessageId(chunk.message_id);
    const finishedAt = Date.now();
    if (assembly.deliveryKind === "daemon_entity_frame") {
      recordLiveHarnessEvent("webrtc_entity_frame_assembly", {
        generation,
        total_bytes: assembly.totalBytes,
        chunk_count: assembly.chunkCount,
        started_at: assembly.startedAt,
        finished_at: finishedAt,
        duration_ms: finishedAt - assembly.startedAt
      });
      this.receiveEntityFrame(payload as DaemonEntityFrame, generation);
      return;
    }

    const pending = assembly.pending;
    if (!pending) {
      throw webrtcFailure("data-plane", "local WebRTC daemon response assembly lost its pending request");
    }
    this.pendingRequests.shift();
    recordLiveHarnessEvent("webrtc_response_assembly", {
      request_type: pending.requestType,
      generation,
      total_bytes: assembly.totalBytes,
      chunk_count: assembly.chunkCount,
      started_at: assembly.startedAt,
      finished_at: finishedAt,
      duration_ms: finishedAt - assembly.startedAt
    });
    pending.resolve(payload as DaemonResponse);
  }

  private validateAssemblyChunk(
    assembly: ResponseAssembly,
    chunk: DaemonLocalWebrtcDeliveryChunk,
    generation: number
  ): void {
    if (
      assembly.generation !== generation ||
      assembly.deliveryKind !== chunk.delivery_kind ||
      assembly.chunkCount !== chunk.chunk_count ||
      assembly.totalBytes !== chunk.total_bytes
    ) {
      throw webrtcFailure("data-plane", "local WebRTC response chunk metadata conflicts with its assembly");
    }
  }

  private ensureAggregateBudget(additionalBytes: number): void {
    if (
      additionalBytes > localWebrtcResponseChunkLimits.maximumAggregateRetainedBytes - this.aggregateRetainedBytes
    ) {
      throw webrtcFailure("data-plane", "local WebRTC response aggregate retained-byte limit exceeded");
    }
  }

  private releaseAssembly(messageId: string, assembly: ResponseAssembly): void {
    window.clearTimeout(assembly.timeout);
    this.responseAssemblies.delete(messageId);
    this.aggregateRetainedBytes -= assembly.retainedBytes;
  }

  private retainCompletedMessageId(messageId: string): void {
    while (
      this.completedMessageIds.size >= localWebrtcResponseChunkLimits.maximumCompletedMessageIds
    ) {
      const oldestMessageId = this.completedMessageIds.values().next().value as string;
      this.completedMessageIds.delete(oldestMessageId);
      this.aggregateRetainedBytes -=
        localWebrtcResponseChunkLimits.completedMessageBookkeepingBytes + utf8ByteLength(oldestMessageId);
    }

    const retainedBytes =
      localWebrtcResponseChunkLimits.completedMessageBookkeepingBytes + utf8ByteLength(messageId);
    this.ensureAggregateBudget(retainedBytes);
    this.completedMessageIds.add(messageId);
    this.aggregateRetainedBytes += retainedBytes;
  }

  private clearAssemblies(): void {
    for (const assembly of this.responseAssemblies.values()) {
      window.clearTimeout(assembly.timeout);
    }
    this.responseAssemblies.clear();
    this.completedMessageIds.clear();
    this.aggregateRetainedBytes = 0;
  }

  private isCurrentPeer(
    generation: number,
    peerConnection: RTCPeerConnection,
    dataChannel: RTCDataChannel
  ): boolean {
    return (
      generation === this.peerGeneration &&
      peerConnection === this.peerConnection &&
      dataChannel === this.dataChannel
    );
  }

  private failPeerGeneration(generation: number, error: unknown): void {
    if (generation !== this.peerGeneration) return;
    this.resetPeerState();
    this.failPending(error);
  }

  private failPending(error: unknown): void {
    for (const pending of this.pendingRequests.splice(0)) {
      pending.reject(error);
    }
  }

  private handleTransportClosed(error: unknown): void {
    this.resetPeerState();
    this.failPending(error);
    if (!this.disconnected && this.entitySubscriptions.size > 0) {
      queueMicrotask(() => void this.reconnectEntitySubscriptions());
    }
  }

  private resetPeerState(): void {
    const dataChannel = this.dataChannel;
    const peerConnection = this.peerConnection;
    this.dataChannel = undefined;
    this.peerConnection = undefined;
    this.connectPromise = undefined;
    this.cryptoKey = undefined;
    this.encryptedStreamReady = false;
    this.clearAssemblies();
    for (const subscription of this.entitySubscriptions) {
      subscription.generation = undefined;
      subscription.subscriptionId = undefined;
      subscription.snapshotSeq = undefined;
      subscription.resubscribing = false;
    }

    if (this.closing) return;
    this.closing = true;
    try {
      if (dataChannel && dataChannel.readyState !== "closed") {
        dataChannel.close?.();
      }
      peerConnection?.close?.();
    } finally {
      this.closing = false;
    }
  }

  private emitLifecycle(event: WebrtcDaemonLifecycleEvent): void {
    this.options.onLifecycle?.(event);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(webRtcDaemonLifecycleEventName, { detail: event }));
    }
  }

  private async reconnectEntitySubscriptions(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      recordLiveHarnessEvent("webrtc_entity_subscription_error", {
        stage: "reconnect",
        message: errorMessage(error)
      });
    }
  }

  private ensureEntitySubscription(subscription: EntitySubscription): Promise<void> {
    return this.connect().then(() => this.startEntitySubscription(subscription, this.peerGeneration));
  }

  private startEntitySubscription(subscription: EntitySubscription, generation: number): Promise<void> {
    if (subscription.closed || generation !== this.peerGeneration) return Promise.resolve();
    if (subscription.generation === generation && subscription.ready) return subscription.ready;

    const subscriptionId = this.options.entitySubscriptionIdGenerator?.(subscription.entityType, generation)
      ?? `${subscription.entityType}-${generation}-${crypto.randomUUID()}`;
    subscription.generation = generation;
    subscription.subscriptionId = subscriptionId;
    subscription.snapshotSeq = undefined;
    if (!subscription.ready) {
      subscription.ready = new Promise<void>((resolve, reject) => {
        subscription.resolveReady = resolve;
        subscription.rejectReady = reject;
      });
    }
    recordLiveHarnessEvent("webrtc_entity_subscription", {
      state: "requested",
      entity_type: subscription.entityType,
      subscription_id: subscriptionId,
      generation
    });
    void this.request({
      type: "subscribe_entities",
      entity_type: subscription.entityType,
      subscription_id: subscriptionId
    }).then((response) => {
      if (response.error) throw new Error(response.error.message);
      if (response.kind !== "entity_subscribed") {
        throw new Error(`entity subscription returned ${response.kind}`);
      }
    }).catch((error: unknown) => {
      if (subscription.generation !== generation || subscription.subscriptionId !== subscriptionId) return;
      subscription.rejectReady?.(error);
      recordLiveHarnessEvent("webrtc_entity_subscription_error", {
        stage: "subscribe",
        entity_type: subscription.entityType,
        subscription_id: subscriptionId,
        generation,
        message: errorMessage(error)
      });
    });
    return subscription.ready;
  }

  private receiveEntityFrame(frame: DaemonEntityFrame, generation: number): void {
    const subscription = Array.from(this.entitySubscriptions).find(
      (candidate) =>
        !candidate.closed &&
        candidate.generation === generation &&
        candidate.subscriptionId === frame.subscription_id &&
        candidate.entityType === frame.entity_type
    );
    if (!subscription) {
      recordLiveHarnessEvent("webrtc_entity_frame_discarded", {
        reason: "stale_generation_or_subscription",
        generation,
        subscription_id: frame.subscription_id,
        entity_type: frame.entity_type,
        type: frame.type
      });
      return;
    }

    if (frame.type === "entity_snapshot") {
      subscription.snapshotSeq = frame.snapshot_seq;
      subscription.resolveReady?.();
      recordLiveHarnessEvent("webrtc_entity_subscription", {
        state: "ready",
        entity_type: frame.entity_type,
        subscription_id: frame.subscription_id,
        generation,
        snapshot_seq: frame.snapshot_seq,
        resync_reason: frame.resync_reason ?? null
      });
      subscription.listener(frame);
      return;
    }

    const currentSequence = subscription.snapshotSeq;
    if (currentSequence === undefined || frame.snapshot_seq !== currentSequence + 1) {
      void this.resubscribeEntity(subscription, generation, currentSequence === undefined ? "delta_before_snapshot" : "sequence_gap");
      return;
    }

    subscription.snapshotSeq = frame.snapshot_seq;
    subscription.listener(frame);
  }

  private async resubscribeEntity(
    subscription: EntitySubscription,
    generation: number,
    reason: string
  ): Promise<void> {
    if (subscription.resubscribing || subscription.closed || generation !== this.peerGeneration) return;
    subscription.resubscribing = true;
    const previousSubscriptionId = subscription.subscriptionId;
    recordLiveHarnessEvent("webrtc_entity_frame_discarded", {
      reason,
      generation,
      subscription_id: previousSubscriptionId,
      entity_type: subscription.entityType
    });
    try {
      if (previousSubscriptionId) {
        await this.request({ type: "unsubscribe_entities", subscription_id: previousSubscriptionId }).catch(() => undefined);
      }
      subscription.generation = undefined;
      subscription.subscriptionId = undefined;
      subscription.snapshotSeq = undefined;
      await this.startEntitySubscription(subscription, generation);
    } finally {
      subscription.resubscribing = false;
    }
  }
}

function webrtcFailure(stage: WebrtcDaemonFailureStage, message: string): WebrtcDaemonClientError {
  return new WebrtcDaemonClientError(stage, message);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "unknown error";
}

function parseDeliveryChunk(frame: string): DaemonLocalWebrtcDeliveryChunk {
  let value: unknown;
  try {
    value = JSON.parse(frame);
  } catch {
    throw webrtcFailure("data-plane", "local WebRTC response chunk is not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw webrtcFailure("data-plane", "local WebRTC response chunk must be an object");
  }

  const chunk = value as Record<string, unknown>;
  if (chunk.version !== 2) {
    throw webrtcFailure("data-plane", "local WebRTC delivery chunk version is unsupported");
  }
  if (chunk.delivery_kind !== "daemon_response" && chunk.delivery_kind !== "daemon_entity_frame") {
    throw webrtcFailure("data-plane", "local WebRTC delivery chunk kind is unsupported");
  }
  if (typeof chunk.message_id !== "string" || chunk.message_id.length === 0) {
    throw webrtcFailure("data-plane", "local WebRTC response chunk message id is invalid");
  }
  if (!isIntegerInRange(chunk.chunk_count, 1, Number.MAX_SAFE_INTEGER)) {
    throw webrtcFailure("data-plane", "local WebRTC response chunk count is invalid");
  }
  if (!isIntegerInRange(chunk.total_bytes, 1, localWebrtcResponseChunkLimits.maximumResponseBytes)) {
    throw webrtcFailure("data-plane", "local WebRTC response total bytes are invalid");
  }
  if (chunk.chunk_count > chunk.total_bytes) {
    throw webrtcFailure("data-plane", "local WebRTC response chunk count exceeds total bytes");
  }
  if (!isIntegerInRange(chunk.chunk_index, 0, chunk.chunk_count - 1)) {
    throw webrtcFailure("data-plane", "local WebRTC response chunk index is invalid");
  }
  if (typeof chunk.payload !== "string") {
    throw webrtcFailure("data-plane", "local WebRTC response chunk payload is empty or invalid");
  }
  const payloadBytes = utf8ByteLength(chunk.payload);
  if (payloadBytes === 0 || payloadBytes > chunk.total_bytes) {
    throw webrtcFailure("data-plane", "local WebRTC response chunk payload bytes are invalid");
  }

  return chunk as unknown as DaemonLocalWebrtcDeliveryChunk;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function encryptDaemonRequest(key: CryptoKey, request: DaemonRequest): Promise<AesGcmEnvelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(request));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(nonce) }, key, plaintext);
  return {
    nonce: base64Encode(nonce),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
    version: 1
  };
}

async function decryptDaemonPayload<T extends DaemonResponse | DaemonEntityFrame>(
  key: CryptoKey,
  envelopeJson: string
): Promise<T> {
  const envelope = JSON.parse(envelopeJson) as AesGcmEnvelope;
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64Decode(envelope.nonce)) },
    key,
    toArrayBuffer(base64Decode(envelope.ciphertext))
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

async function importStreamKey(secret: string): Promise<CryptoKey> {
  const encoded = secret.startsWith("secret-") ? secret.slice("secret-".length) : "";
  const keyBytes = hexDecode(encoded);
  if (keyBytes.length !== 32) {
    throw new Error("invalid local WebRTC bootstrap secret");
  }
  return crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), "AES-GCM", false, ["encrypt", "decrypt"]);
}

function hexDecode(encoded: string): Uint8Array {
  if (encoded.length % 2 !== 0) return new Uint8Array();
  const output = new Uint8Array(encoded.length / 2);
  for (let index = 0; index < encoded.length; index += 2) {
    const value = Number.parseInt(encoded.slice(index, index + 2), 16);
    if (Number.isNaN(value)) return new Uint8Array();
    output[index / 2] = value;
  }
  return output;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function recordLiveHarnessEvent(kind: string, payload: unknown): void {
  if (typeof window === "undefined") return;

  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      events?: Array<{ kind: string; payload: unknown }>;
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  harness?.events?.push({ kind, payload: redactedHarnessPayload(payload) });
}

function redactedHarnessPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((entry) => redactedHarnessPayload(entry));
  }
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const safePayload = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      key === "grant_secret" ? "[redacted]" : redactedHarnessPayload(value)
    ])
  );
  if (record.type === "local_webrtc_signal") {
    return {
      ...safePayload,
      grant_secret: "[redacted]"
    };
  }

  return safePayload;
}

function base64Decode(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function waitForIceGatheringComplete(peerConnection: RTCPeerConnection): Promise<void> {
  if (peerConnection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(done, 5_000);
    function done() {
      window.clearTimeout(timeout);
      peerConnection.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }
    function onChange() {
      if (peerConnection.iceGatheringState === "complete") {
        done();
      }
    }
    peerConnection.addEventListener("icegatheringstatechange", onChange);
  });
}

function waitForDataChannelOpen(dataChannel: RTCDataChannel): Promise<void> {
  if (dataChannel.readyState === "open") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for local WebRTC data channel"));
    }, requestTimeoutMs);
    const cleanup = () => {
      window.clearTimeout(timeout);
      dataChannel.removeEventListener("open", onOpen);
      dataChannel.removeEventListener("error", onError);
      dataChannel.removeEventListener("close", onClose);
    };
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("local WebRTC data channel failed before open"));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("local WebRTC data channel closed before open"));
    };
    dataChannel.addEventListener("open", onOpen);
    dataChannel.addEventListener("error", onError);
    dataChannel.addEventListener("close", onClose);
  });
}
