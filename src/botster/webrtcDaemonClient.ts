import type { TerminalEvent } from "@trybotster/terminal-protocol";
import type {
  AesGcmEnvelope,
  DaemonBridgeRequestEnvelope,
  DaemonBridgeResponseEnvelope,
  DaemonEntityFrame,
  DaemonEvent,
  DaemonHello,
  DaemonHelloAck,
  DaemonLocalWebrtcBootstrap,
  DaemonLocalWebrtcDeliveryChunk,
  DaemonLocalWebrtcDeliveryKind,
  DaemonRequest,
  DaemonResponse,
  DaemonSubscriptionReservation,
  DaemonTerminalReservation,
  JsonValue
} from "./realHubDaemonDto";
import type { DaemonBridgeClient, TerminalStreamEvent } from "./hubTransport";
import {
  hostCompatibilityRequirement,
  hostHelloProtocol,
  terminalCompatibilityRequirement
} from "./protocolPlanes";

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
  eventSubscriptionIdGenerator?: (
    spec: { owner: string; name: string },
    generation: number
  ) => string;
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
  | { type: "encrypted-stream-ready"; requestType: string }
  | { type: "terminal-data-channel-closed"; sessionId: string; subscriptionId: string; generation: number }
  | {
      type: "subscription-data-channel-failed";
      channelClass: "entity" | "package_event";
      subscriptionId: string;
      reason: "reservation_missing" | "rejected" | "expired" | "closed";
      detail: string;
    }
  | { type: "hello-ack"; hostCompatible: boolean; terminalCompatible: boolean; detail: string };

export const webRtcDaemonLifecycleEventName = "botster:webrtc-daemon-lifecycle";

type PendingKind = "hello" | "request";

type PendingRequest = {
  generation: number;
  requestType: string;
  kind: PendingKind;
  request: DaemonRequest | DaemonHello;
  messageId?: string;
  resolve(response: DaemonResponse | DaemonHelloAck): void;
  reject(error: unknown): void;
};

type TerminalStreamListener = {
  sessionId: string;
  subscriptionId: string;
  peerGeneration: number;
  coreGeneration: number;
  closed: boolean;
  onEvent(event: TerminalStreamEvent): void | Promise<void>;
};

type TerminalChannelAssembly = {
  messageId: string;
  chunkCount: number;
  totalBytes: number;
  nextIndex: number;
  payloads: string[];
  receivedBytes: number;
  timeout: number;
};

type TerminalChannelBinding = {
  listener: TerminalStreamListener;
  channel: RTCDataChannel;
  peerGeneration: number;
  transportGeneration: number;
  generation: number;
  label: string;
  closed: boolean;
  admitted: boolean;
  outboundCounter: number;
  completedMessageIds: Set<string>;
  assembly?: TerminalChannelAssembly;
  resolveReady(): void;
  rejectReady(error: unknown): void;
  expiryTimeout: number;
};

type SubscriptionChannelAssembly = {
  messageId: string;
  chunkCount: number;
  totalBytes: number;
  nextIndex: number;
  payloads: string[];
  receivedBytes: number;
  timeout: number;
};

type SubscriptionChannelBindingBase = {
  channel: RTCDataChannel;
  peerGeneration: number;
  transportGeneration: number;
  generation: number;
  subscriptionId: string;
  label: string;
  closed: boolean;
  admitted: boolean;
  completedMessageIds: Set<string>;
  assembly?: SubscriptionChannelAssembly;
  resolveReady(): void;
  rejectReady(error: unknown): void;
  expiryTimeout: number;
};

type EntityChannelBinding = SubscriptionChannelBindingBase & {
  channelClass: "entity";
  owner: EntitySubscription;
};

type PackageEventChannelBinding = SubscriptionChannelBindingBase & {
  channelClass: "package_event";
  owner: PackageEventHolder;
};

type SubscriptionChannelBinding = EntityChannelBinding | PackageEventChannelBinding;
type PackageEvent = Extract<DaemonEvent, { type: "package_event" | "event_gap" }>;

/** Test/live-harness switch: skip production assembly-timeout cleanup so ablation goes red. */
export let applyAssemblyTimeoutCleanup = true;

export function setApplyAssemblyTimeoutCleanup(enabled: boolean): void {
  applyAssemblyTimeoutCleanup = enabled;
}

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
  channel?: EntityChannelBinding;
  resubscribing: boolean;
  closed: boolean;
};

type PackageEventHolder = {
  owner: string;
  name: string;
  subjects: string[];
  listener(event: DaemonEvent): void;
  generation?: number;
  subscriptionId?: string;
  ready?: Promise<void>;
  resolveReady?: () => void;
  rejectReady?: (error: unknown) => void;
  channel?: PackageEventChannelBinding;
  resubscribing: boolean;
  closed: boolean;
};

/** Delta frame types that the live-harness one-shot drop control may match. */
export type DropNextInboundEntityFrameType = "entity_upsert" | "entity_patch" | "entity_remove";

export type DropNextInboundEntityFrameFilter = {
  /** Required entity family (e.g. botster-workspaces.membership). */
  entity_type: string;
  /**
   * Allowed delta types. Defaults to all three delta types.
   * Never matches entity_snapshot or entity_error.
   */
  frame_types?: DropNextInboundEntityFrameType[];
  /** Optional tighter bind when the subscription id is known. */
  subscription_id?: string;
};

export type DropNextInboundEntityFrameArmResult =
  | { ok: true; state: "armed"; filter: DropNextInboundEntityFrameFilter }
  | {
      ok: false;
      state: "not_armed";
      reason: "no_harness" | "no_peer" | "already_armed" | "invalid_filter";
    };

export type DropNextInboundEntityFrameState =
  | { state: "idle" }
  | { state: "armed"; filter: DropNextInboundEntityFrameFilter; armed_at: number }
  | {
      state: "dropped";
      filter: DropNextInboundEntityFrameFilter;
      entity_type: string;
      subscription_id: string;
      frame_type: string;
      snapshot_seq: number;
      generation: number;
      dropped_at: number;
    }
  | {
      state: "timed_out";
      filter: DropNextInboundEntityFrameFilter;
      armed_at: number;
      timed_out_at: number;
    }
  | { state: "disarmed"; reason: "manual" | "peer_reset" };

const DEFAULT_DROP_FRAME_TYPES: readonly DropNextInboundEntityFrameType[] = [
  "entity_upsert",
  "entity_patch",
  "entity_remove"
];

/** Default one-shot arm lifetime. Prevents a stale arm from catching a late unrelated frame. */
export const DROP_NEXT_INBOUND_ENTITY_FRAME_ARM_TIMEOUT_MS = 30_000;

function normalizeDropFilter(
  filter: DropNextInboundEntityFrameFilter | null | undefined
): DropNextInboundEntityFrameFilter | null {
  if (!filter || typeof filter !== "object") return null;
  const entityType = typeof filter.entity_type === "string" ? filter.entity_type.trim() : "";
  if (!entityType) return null;

  let frameTypes: DropNextInboundEntityFrameType[] | undefined;
  if (filter.frame_types !== undefined) {
    if (!Array.isArray(filter.frame_types) || filter.frame_types.length === 0) return null;
    const allowed = new Set<string>(DEFAULT_DROP_FRAME_TYPES);
    const normalized: DropNextInboundEntityFrameType[] = [];
    for (const entry of filter.frame_types) {
      if (typeof entry !== "string" || !allowed.has(entry)) return null;
      if (!normalized.includes(entry as DropNextInboundEntityFrameType)) {
        normalized.push(entry as DropNextInboundEntityFrameType);
      }
    }
    if (normalized.length === 0) return null;
    frameTypes = normalized;
  }

  let subscriptionId: string | undefined;
  if (filter.subscription_id !== undefined) {
    if (typeof filter.subscription_id !== "string" || !filter.subscription_id.trim()) return null;
    subscriptionId = filter.subscription_id.trim();
  }

  return {
    entity_type: entityType,
    ...(frameTypes ? { frame_types: frameTypes } : {}),
    ...(subscriptionId ? { subscription_id: subscriptionId } : {})
  };
}

function dropFilterAllowsFrame(
  filter: DropNextInboundEntityFrameFilter,
  frame: DaemonEntityFrame
): boolean {
  if (frame.entity_type !== filter.entity_type) return false;
  if (filter.subscription_id && frame.subscription_id !== filter.subscription_id) return false;
  if (frame.type === "entity_snapshot" || frame.type === "entity_error") return false;
  const allowed = filter.frame_types ?? DEFAULT_DROP_FRAME_TYPES;
  return (allowed as readonly string[]).includes(frame.type);
}

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
const terminalChunkPayloadBytes = 12_288;

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
  const client: DaemonBridgeClient = {
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
    subscribePackageEvents(spec, onEvent) {
      return transport.subscribePackageEvents(spec, onEvent);
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      let closed = false;
      const listener = transport.addTerminalStreamListener(sessionId, subscriptionId, async (event) => {
        if (closed) return;
        if (event.type !== "terminal_subscription_closed") {
          eventListeners.forEach((subscriber) => subscriber(event as unknown as DaemonEvent));
        }
        await onEvent(event);
      });

      const stopDelivery = () => {
        closed = true;
        listener.closed = true;
        transport.removeTerminalStreamListener(listener);
      };

      let binding: TerminalChannelBinding | undefined;
      const ready = transport
        .request({ type: "attach", session_id: sessionId, subscription_id: subscriptionId })
        .then(async (response) => {
          if (closed) return;
          if (response.error) {
            throw webrtcFailure("data-plane", response.error.message);
          }
          const reservation = response.terminal_reservation;
          if (response.kind !== "terminal_reservation" || !reservation) {
            throw webrtcFailure("data-plane", "attach response did not include a terminal reservation");
          }
          if (reservation.session_id !== sessionId || reservation.subscription_id !== subscriptionId) {
            throw webrtcFailure("data-plane", "terminal reservation identity did not match Attach");
          }
          binding = await transport.openTerminalChannel(listener, reservation, (createdBinding) => {
            binding = createdBinding;
            if (closed) transport.closeTerminalChannel(createdBinding);
          });
        })
        .catch((error: unknown) => {
          recordLiveHarnessEvent("terminal_stream_error", {
            stage: "attach",
            message: error instanceof Error ? error.message : String(error)
          });
          stopDelivery();
          throw error;
        });

      return {
        ready,
        sendFrame: async (frame: Uint8Array) => {
          await ready;
          if (!binding) throw webrtcFailure("transport", "terminal subscription channel is unavailable");
          await transport.sendTerminalFrame(binding, frame);
        },
        get generation() { return binding?.generation; },
        get peerGeneration() { return binding?.peerGeneration; },
        get label() { return binding?.label; },
        abandon: () => {
          stopDelivery();
          if (binding) transport.closeTerminalChannel(binding);
        },
        unsubscribe: () => {
          stopDelivery();
          if (binding) transport.closeTerminalChannel(binding);
          void transport
            .request({ type: "detach", session_id: sessionId, subscription_id: subscriptionId })
            .catch((error: unknown) => {
              recordLiveHarnessEvent("terminal_stream_error", {
                stage: "detach",
                message: error instanceof Error ? error.message : String(error)
              });
            });
        }
      };
    }
  };
  installLiveHarnessTransportControl(transport, client);
  return client;
}

class WebrtcDaemonTransport {
  private readonly fetchImpl: typeof fetch;
  private readonly peerConnectionFactory: () => RTCPeerConnection;
  private readonly pageHideHandler: (() => void) | undefined;
  private readonly pendingRequests: PendingRequest[] = [];
  private peerFailed = false;
  private readonly responseAssemblies = new Map<string, ResponseAssembly>();
  private readonly completedMessageIds = new Set<string>();
  private readonly entitySubscriptions = new Set<EntitySubscription>();
  private readonly packageEventHolders = new Set<PackageEventHolder>();
  private readonly terminalStreamListeners = new Set<TerminalStreamListener>();
  private readonly terminalChannels = new Set<TerminalChannelBinding>();
  private readonly subscriptionChannels = new Set<SubscriptionChannelBinding>();
  private readonly subscriptionGenerations = new Map<string, number>();
  private helloPromise: Promise<DaemonHelloAck> | undefined;
  private peerConnection: RTCPeerConnection | undefined;
  private dataChannel: RTCDataChannel | undefined;
  private cryptoKey: CryptoKey | undefined;
  private connectPromise: Promise<void> | undefined;
  private encryptedStreamReady = false;
  private disconnected = false;
  private closing = false;
  private peerGeneration = 0;
  private aggregateRetainedBytes = 0;
  private dropNextInboundEntityFrameState: DropNextInboundEntityFrameState = { state: "idle" };
  private dropNextInboundEntityFrameTimeout: number | undefined;

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
    const response = await this.sendEncrypted<DaemonResponse>(
      request,
      request.type,
      "request",
      (payload) => payload as DaemonResponse
    );
    if (request.type === "drain" && (response.events ?? []).some(isTerminalBodyEvent)) {
      throw webrtcFailure("data-plane", "host drain returned a terminal body");
    }
    return response;
  }

  addTerminalStreamListener(
    sessionId: string,
    subscriptionId: string,
    onEvent: (event: TerminalStreamEvent) => void | Promise<void>
  ): TerminalStreamListener {
    const coreGeneration = (this.subscriptionGenerations.get(subscriptionId) ?? 0) + 1;
    this.subscriptionGenerations.set(subscriptionId, coreGeneration);
    const listener: TerminalStreamListener = {
      sessionId,
      subscriptionId,
      peerGeneration: this.peerGeneration,
      coreGeneration,
      closed: false,
      onEvent
    };
    this.terminalStreamListeners.add(listener);
    return listener;
  }

  removeTerminalStreamListener(listener: TerminalStreamListener): void {
    listener.closed = true;
    this.terminalStreamListeners.delete(listener);
  }

  async openTerminalChannel(
    listener: TerminalStreamListener,
    reservation: DaemonTerminalReservation,
    onCreated: (binding: TerminalChannelBinding) => void
  ): Promise<TerminalChannelBinding> {
    if (listener.closed) {
      throw webrtcFailure("transport", "terminal reservation owner closed before channel creation");
    }
    const peerConnection = this.peerConnection;
    const key = this.cryptoKey;
    if (!peerConnection || !key || this.dataChannel?.readyState !== "open") {
      throw webrtcFailure("transport", "terminal reservation arrived without an open control peer");
    }
    const transportGeneration = this.peerGeneration;
    let channel: RTCDataChannel;
    try {
      channel = peerConnection.createDataChannel(reservation.label, { ordered: true });
    } catch (error) {
      throw webrtcFailure("transport", `terminal DataChannel creation failed: ${errorMessage(error)}`);
    }
    listener.peerGeneration = reservation.peer_generation;
    listener.coreGeneration = reservation.generation;
    let binding!: TerminalChannelBinding;
    const ready = new Promise<void>((resolve, reject) => {
      binding = {
        listener,
        channel,
        peerGeneration: reservation.peer_generation,
        transportGeneration,
        generation: reservation.generation,
        label: reservation.label,
        closed: false,
        admitted: false,
        outboundCounter: 0,
        completedMessageIds: new Set(),
        resolveReady: resolve,
        rejectReady: reject,
        expiryTimeout: window.setTimeout(() => {
          const error = webrtcFailure("data-plane", "terminal reservation expired before admission");
          binding.rejectReady(error);
          this.closeTerminalChannel(binding);
        }, Math.max(1, reservation.expires_in_seconds) * 1_000)
      };
    });
    this.terminalChannels.add(binding);
    onCreated(binding);
    if (listener.closed || binding.closed) {
      this.closeTerminalChannel(binding);
      throw webrtcFailure("transport", "terminal reservation owner closed during channel creation");
    }
    let messageQueue = Promise.resolve();
    channel.addEventListener("message", (event) => {
      if (binding.closed) return;
      messageQueue = messageQueue
        .then(() => this.handleTerminalChannelMessage(binding, event.data))
        .catch((error: unknown) => {
          binding.rejectReady(error);
          this.closeTerminalChannel(binding, true);
        });
    });
    channel.addEventListener("close", () => this.closeTerminalChannel(binding, true));
    channel.addEventListener("error", () => this.closeTerminalChannel(binding, true));
    try {
      await waitForDataChannelOpen(channel);
      if (listener.closed || binding.closed || transportGeneration !== this.peerGeneration) {
        throw webrtcFailure("transport", "terminal DataChannel opened for a stale reservation");
      }
      const hello: DaemonHello = {
        protocol: hostHelloProtocol,
        compatibility: hostCompatibilityRequirement,
        terminal_compatibility: terminalCompatibilityRequirement
      };
      channel.send(JSON.stringify(await encryptJsonPayload(key, hello)));
      await ready;
      if (listener.closed || binding.closed || transportGeneration !== this.peerGeneration) {
        throw webrtcFailure("transport", "terminal DataChannel admitted for a stale reservation");
      }
      return binding;
    } catch (error) {
      binding.rejectReady(error);
      this.closeTerminalChannel(binding);
      throw error;
    }
  }

  async sendTerminalFrame(binding: TerminalChannelBinding, frame: Uint8Array): Promise<void> {
    const key = this.cryptoKey;
    if (binding.closed || !binding.admitted || !key || binding.channel.readyState !== "open") {
      throw webrtcFailure("transport", "terminal subscription channel is not ready");
    }
    const envelopeJson = JSON.stringify(await encryptBytesPayload(key, frame));
    const totalBytes = utf8ByteLength(envelopeJson);
    const chunkCount = Math.ceil(totalBytes / terminalChunkPayloadBytes);
    const messageId = `${binding.peerGeneration}:${binding.generation}:${++binding.outboundCounter}`;
    recordLiveHarnessEvent("terminal_data_channel_send", {
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      message_id: messageId,
      chunk_count: chunkCount,
      total_bytes: totalBytes,
      frame_kind: frame[1] ?? null
    });
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      if (binding.closed || binding.channel.readyState !== "open") {
        throw webrtcFailure("transport", "terminal subscription channel closed during send");
      }
      const payload = envelopeJson.slice(
        chunkIndex * terminalChunkPayloadBytes,
        (chunkIndex + 1) * terminalChunkPayloadBytes
      );
      const chunk: DaemonLocalWebrtcDeliveryChunk = {
        version: 2,
        delivery_kind: "daemon_terminal_frame",
        message_id: messageId,
        chunk_index: chunkIndex,
        chunk_count: chunkCount,
        total_bytes: totalBytes,
        payload
      };
      const serialized = JSON.stringify(chunk);
      if (utf8ByteLength(serialized) >= localWebrtcResponseChunkLimits.maximumFrameBytesExclusive) {
        throw webrtcFailure("data-plane", "terminal delivery chunk exceeds the transport limit");
      }
      binding.channel.send(serialized);
    }
  }

  closeTerminalChannel(binding: TerminalChannelBinding, remote = false): void {
    if (binding.closed) return;
    binding.closed = true;
    recordLiveHarnessEvent("terminal_data_channel", {
      state: "closed",
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      remote
    });
    binding.rejectReady(webrtcFailure("transport", "terminal subscription channel closed"));
    window.clearTimeout(binding.expiryTimeout);
    if (binding.assembly) window.clearTimeout(binding.assembly.timeout);
    this.terminalChannels.delete(binding);
    if (!remote || !binding.admitted) {
      this.removeTerminalStreamListener(binding.listener);
    }
    if (binding.channel.readyState !== "closed") binding.channel.close?.();
    if (remote && binding.admitted) {
      this.emitLifecycle({
        type: "terminal-data-channel-closed",
        sessionId: binding.listener.sessionId,
        subscriptionId: binding.listener.subscriptionId,
        generation: binding.generation
      });
    }
  }

  private async handleTerminalChannelMessage(binding: TerminalChannelBinding, data: unknown): Promise<void> {
    if (typeof data !== "string" || utf8ByteLength(data) >= localWebrtcResponseChunkLimits.maximumFrameBytesExclusive) {
      throw webrtcFailure("data-plane", "terminal DataChannel delivery must be a bounded string chunk");
    }
    const chunk = parseDeliveryChunk(data);
    if (binding.admitted && chunk.delivery_kind !== "daemon_terminal_frame") {
      throw webrtcFailure("data-plane", "bound terminal channel received a non-terminal delivery");
    }
    if (binding.completedMessageIds.has(chunk.message_id)) {
      throw webrtcFailure("data-plane", "terminal channel reused a completed message id");
    }
    let assembly = binding.assembly;
    if (!assembly) {
      if (chunk.chunk_index !== 0) throw webrtcFailure("data-plane", "terminal delivery did not start at chunk zero");
      assembly = binding.assembly = {
        messageId: chunk.message_id,
        chunkCount: chunk.chunk_count,
        totalBytes: chunk.total_bytes,
        nextIndex: 0,
        payloads: [],
        receivedBytes: 0,
        timeout: window.setTimeout(() => {
          if (!binding.closed) {
            binding.rejectReady(webrtcFailure("data-plane", "terminal delivery assembly timed out"));
            this.closeTerminalChannel(binding, true);
          }
        }, requestTimeoutMs)
      };
    }
    if (
      assembly.messageId !== chunk.message_id ||
      assembly.chunkCount !== chunk.chunk_count ||
      assembly.totalBytes !== chunk.total_bytes ||
      chunk.chunk_index !== assembly.nextIndex
    ) {
      throw webrtcFailure("data-plane", "terminal delivery chunk order or metadata was invalid");
    }
    recordLiveHarnessEvent("terminal_data_channel_receive", {
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      message_id: chunk.message_id,
      chunk_index: chunk.chunk_index,
      chunk_count: chunk.chunk_count,
      total_bytes: chunk.total_bytes,
      delivery_kind: chunk.delivery_kind,
      frame_bytes: utf8ByteLength(data)
    });
    assembly.payloads.push(chunk.payload);
    assembly.receivedBytes += utf8ByteLength(chunk.payload);
    if (assembly.receivedBytes > assembly.totalBytes) {
      throw webrtcFailure("data-plane", "terminal delivery exceeded the declared total bytes");
    }
    assembly.nextIndex += 1;
    if (assembly.nextIndex !== assembly.chunkCount) return;
    if (assembly.receivedBytes !== assembly.totalBytes) {
      throw webrtcFailure("data-plane", "terminal delivery bytes did not match the declared total");
    }
    window.clearTimeout(assembly.timeout);
    binding.assembly = undefined;
    if (binding.completedMessageIds.size >= localWebrtcResponseChunkLimits.maximumCompletedMessageIds) {
      const oldestMessageId = binding.completedMessageIds.values().next().value as string;
      binding.completedMessageIds.delete(oldestMessageId);
    }
    binding.completedMessageIds.add(assembly.messageId);
    const key = this.cryptoKey;
    if (!key) throw webrtcFailure("encryption", "terminal response key is unavailable");
    const payload = await decryptDaemonPayload(key, assembly.payloads.join(""));
    if (!binding.admitted) {
      const ack = payload as DaemonHelloAck;
      if (!ack || ack.protocol !== hostHelloProtocol || !isTerminalCompatibilityAccepted(ack.terminal_compatibility)) {
        throw webrtcFailure("data-plane", "terminal DataChannel Hello was rejected");
      }
      binding.admitted = true;
      window.clearTimeout(binding.expiryTimeout);
      binding.resolveReady();
      recordLiveHarnessEvent("terminal_data_channel", {
        state: "ready",
        label: binding.label,
        generation: binding.generation,
        peer_generation: binding.peerGeneration
      });
      return;
    }
    const event = parseTerminalEvent(payload);
    const sessionMatches = event.type === "input_result" || event.session_id === binding.listener.sessionId;
    if (!sessionMatches || event.subscription_id !== binding.listener.subscriptionId || binding.listener.closed) return;
    recordLiveHarnessEvent("daemon_terminal_event", event);
    await binding.listener.onEvent(event);
  }

  private async openSubscriptionChannel(
    owner: EntitySubscription | PackageEventHolder,
    reservation: DaemonSubscriptionReservation,
    channelClass: "entity" | "package_event"
  ): Promise<SubscriptionChannelBinding> {
    if (owner.closed) {
      throw webrtcFailure("transport", "subscription reservation owner closed before channel creation");
    }
    if (reservation.kind !== channelClass || reservation.subscription_id !== owner.subscriptionId) {
      throw webrtcFailure("data-plane", "subscription reservation identity did not match the request");
    }
    const { channel, key, transportGeneration } = this.createReservedDataChannel(
      reservation.label,
      channelClass
    );

    let binding!: SubscriptionChannelBinding;
    const ready = new Promise<void>((resolve, reject) => {
      const base: SubscriptionChannelBindingBase = {
        channel,
        peerGeneration: reservation.peer_generation,
        transportGeneration,
        generation: reservation.generation,
        subscriptionId: reservation.subscription_id,
        label: reservation.label,
        closed: false,
        admitted: false,
        completedMessageIds: new Set(),
        resolveReady: resolve,
        rejectReady: reject,
        expiryTimeout: window.setTimeout(() => {
          const error = webrtcFailure("data-plane", "subscription reservation expired before admission");
          this.emitSubscriptionChannelFailure(binding, "expired", error);
          binding.rejectReady(error);
          this.closeSubscriptionChannel(binding);
        }, Math.max(1, reservation.expires_in_seconds) * 1_000)
      };
      binding = channelClass === "entity"
        ? { ...base, channelClass, owner: owner as EntitySubscription }
        : { ...base, channelClass, owner: owner as PackageEventHolder };
    });

    this.subscriptionChannels.add(binding);
    if (binding.channelClass === "entity") binding.owner.channel = binding;
    else binding.owner.channel = binding;
    recordLiveHarnessEvent("subscription_data_channel", {
      class: channelClass,
      state: "created",
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      subscription_id: binding.subscriptionId,
      ...subscriptionChannelOwnerPayload(binding),
      remote: false
    });

    let messageQueue = Promise.resolve();
    channel.addEventListener("message", (event) => {
      if (binding.closed) return;
      messageQueue = messageQueue
        .then(() => this.handleSubscriptionChannelMessage(binding, event.data))
        .catch((error: unknown) => {
          this.emitSubscriptionChannelFailure(binding, "rejected", error);
          binding.rejectReady(error);
          this.closeSubscriptionChannel(binding, true);
        });
    });
    channel.addEventListener("close", () => this.closeSubscriptionChannel(binding, true));
    channel.addEventListener("error", () => this.closeSubscriptionChannel(binding, true));

    try {
      await waitForDataChannelOpen(channel);
      if (!this.isCurrentSubscriptionBinding(binding)) {
        throw webrtcFailure("transport", "subscription DataChannel opened for a stale reservation");
      }
      recordLiveHarnessEvent("subscription_data_channel", {
        class: channelClass,
        state: "open",
        label: binding.label,
        generation: binding.generation,
        peer_generation: binding.peerGeneration,
        subscription_id: binding.subscriptionId,
        ...subscriptionChannelOwnerPayload(binding),
        remote: false
      });
      const hello: DaemonHello = {
        protocol: hostHelloProtocol,
        compatibility: hostCompatibilityRequirement
      };
      channel.send(JSON.stringify(await encryptJsonPayload(key, hello)));
      await ready;
      if (!this.isCurrentSubscriptionBinding(binding)) {
        throw webrtcFailure("transport", "subscription DataChannel admitted for a stale reservation");
      }
      return binding;
    } catch (error) {
      binding.rejectReady(error);
      this.closeSubscriptionChannel(binding);
      throw error;
    }
  }

  private closeSubscriptionChannel(binding: SubscriptionChannelBinding, remote = false): void {
    if (binding.closed) return;
    const wasCurrent = this.isCurrentSubscriptionBinding(binding);
    binding.closed = true;
    recordLiveHarnessEvent("subscription_data_channel", {
      class: binding.channelClass,
      state: "closed",
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      subscription_id: binding.subscriptionId,
      ...subscriptionChannelOwnerPayload(binding),
      remote
    });
    binding.rejectReady(webrtcFailure("transport", "subscription DataChannel closed"));
    window.clearTimeout(binding.expiryTimeout);
    if (binding.assembly) window.clearTimeout(binding.assembly.timeout);
    this.subscriptionChannels.delete(binding);
    if (binding.owner.channel === binding) binding.owner.channel = undefined;
    if (binding.channel.readyState !== "closed") binding.channel.close?.();

    if (!remote || !binding.admitted || !wasCurrent) return;
    this.emitSubscriptionChannelFailure(
      binding,
      "closed",
      webrtcFailure("transport", "admitted subscription DataChannel closed")
    );
    if (binding.channelClass === "entity") {
      void this.resubscribeEntity(binding.owner, binding.transportGeneration, "channel_closed");
    } else {
      void this.resubscribePackageEvent(binding.owner, binding.transportGeneration);
    }
  }

  private async handleSubscriptionChannelMessage(
    binding: SubscriptionChannelBinding,
    data: unknown
  ): Promise<void> {
    if (typeof data !== "string" || utf8ByteLength(data) >= localWebrtcResponseChunkLimits.maximumFrameBytesExclusive) {
      throw webrtcFailure("data-plane", "subscription DataChannel delivery must be a bounded string chunk");
    }
    const chunk = parseDeliveryChunk(data);
    const expectedKind = binding.channelClass === "entity" ? "daemon_entity_frame" : "daemon_event";
    if (binding.admitted && chunk.delivery_kind !== expectedKind) {
      throw webrtcFailure("data-plane", "bound subscription channel received a delivery for another class");
    }
    if (binding.completedMessageIds.has(chunk.message_id)) {
      throw webrtcFailure("data-plane", "subscription channel reused a completed message id");
    }
    let assembly = binding.assembly;
    if (!assembly) {
      if (chunk.chunk_index !== 0) {
        throw webrtcFailure("data-plane", "subscription delivery did not start at chunk zero");
      }
      assembly = binding.assembly = {
        messageId: chunk.message_id,
        chunkCount: chunk.chunk_count,
        totalBytes: chunk.total_bytes,
        nextIndex: 0,
        payloads: [],
        receivedBytes: 0,
        timeout: window.setTimeout(() => {
          if (!binding.closed) {
            const error = webrtcFailure("data-plane", "subscription delivery assembly timed out");
            this.emitSubscriptionChannelFailure(binding, "rejected", error);
            binding.rejectReady(error);
            this.closeSubscriptionChannel(binding, true);
          }
        }, requestTimeoutMs)
      };
    }
    if (
      assembly.messageId !== chunk.message_id ||
      assembly.chunkCount !== chunk.chunk_count ||
      assembly.totalBytes !== chunk.total_bytes ||
      chunk.chunk_index !== assembly.nextIndex
    ) {
      throw webrtcFailure("data-plane", "subscription delivery chunk order or metadata was invalid");
    }
    recordLiveHarnessEvent("subscription_data_channel_receive", {
      class: binding.channelClass,
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      subscription_id: binding.subscriptionId,
      ...subscriptionChannelOwnerPayload(binding),
      message_id: chunk.message_id,
      chunk_index: chunk.chunk_index,
      chunk_count: chunk.chunk_count,
      total_bytes: chunk.total_bytes,
      delivery_kind: chunk.delivery_kind,
      frame_bytes: utf8ByteLength(data)
    });
    assembly.payloads.push(chunk.payload);
    assembly.receivedBytes += utf8ByteLength(chunk.payload);
    if (assembly.receivedBytes > assembly.totalBytes) {
      throw webrtcFailure("data-plane", "subscription delivery exceeded the declared total bytes");
    }
    assembly.nextIndex += 1;
    if (assembly.nextIndex !== assembly.chunkCount) return;
    if (assembly.receivedBytes !== assembly.totalBytes) {
      throw webrtcFailure("data-plane", "subscription delivery bytes did not match the declared total");
    }
    window.clearTimeout(assembly.timeout);
    binding.assembly = undefined;
    if (binding.completedMessageIds.size >= localWebrtcResponseChunkLimits.maximumCompletedMessageIds) {
      const oldestMessageId = binding.completedMessageIds.values().next().value as string;
      binding.completedMessageIds.delete(oldestMessageId);
    }
    binding.completedMessageIds.add(assembly.messageId);
    const key = this.cryptoKey;
    if (!key) throw webrtcFailure("encryption", "subscription response key is unavailable");
    const payload = await decryptDaemonPayload(key, assembly.payloads.join(""));

    if (!binding.admitted) {
      const ack = payload as DaemonHelloAck;
      if (!ack || ack.protocol !== hostHelloProtocol || !ack.compatibility) {
        throw webrtcFailure("data-plane", "subscription DataChannel Hello was rejected");
      }
      binding.admitted = true;
      window.clearTimeout(binding.expiryTimeout);
      binding.resolveReady();
      recordLiveHarnessEvent("subscription_data_channel", {
        class: binding.channelClass,
        state: "ready",
        label: binding.label,
        generation: binding.generation,
        peer_generation: binding.peerGeneration,
        subscription_id: binding.subscriptionId,
        ...subscriptionChannelOwnerPayload(binding),
        remote: false
      });
      return;
    }

    if (!this.isCurrentSubscriptionBinding(binding)) return;
    if (binding.channelClass === "entity") {
      const frame = payload as DaemonEntityFrame;
      recordLiveHarnessEvent("webrtc_entity_frame_assembly", {
        generation: binding.transportGeneration,
        label: binding.label,
        total_bytes: assembly.totalBytes,
        chunk_count: assembly.chunkCount
      });
      if (!this.maybeDropArmedInboundEntityFrame(frame, binding.transportGeneration)) {
        this.receiveEntityFrame(frame, binding.transportGeneration);
      }
      return;
    }

    const event = payload as DaemonEvent;
    if (event.type !== "package_event" && event.type !== "event_gap") {
      throw webrtcFailure("data-plane", "package-event channel received an unsupported event type");
    }
    recordLiveHarnessEvent("webrtc_daemon_event_assembly", {
      generation: binding.transportGeneration,
      label: binding.label,
      total_bytes: assembly.totalBytes,
      chunk_count: assembly.chunkCount
    });
    this.receivePackageEvent(binding, event);
  }

  private isCurrentSubscriptionBinding(binding: SubscriptionChannelBinding): boolean {
    return (
      !binding.closed &&
      binding.transportGeneration === this.peerGeneration &&
      !binding.owner.closed &&
      binding.owner.channel === binding &&
      binding.owner.generation === binding.transportGeneration &&
      binding.owner.subscriptionId === binding.subscriptionId
    );
  }

  private emitSubscriptionChannelFailure(
    binding: Pick<SubscriptionChannelBindingBase, "subscriptionId"> & { channelClass: "entity" | "package_event" },
    reason: "reservation_missing" | "rejected" | "expired" | "closed",
    error: unknown
  ): void {
    this.emitLifecycle({
      type: "subscription-data-channel-failed",
      channelClass: binding.channelClass,
      subscriptionId: binding.subscriptionId,
      reason,
      detail: errorMessage(error)
    });
  }

  private createReservedDataChannel(
    label: string,
    channelClass: "entity" | "package_event"
  ): { channel: RTCDataChannel; key: CryptoKey; transportGeneration: number } {
    const peerConnection = this.peerConnection;
    const key = this.cryptoKey;
    if (!peerConnection || !key || this.dataChannel?.readyState !== "open") {
      throw webrtcFailure("transport", `${channelClass} reservation arrived without an open control peer`);
    }
    try {
      return {
        channel: peerConnection.createDataChannel(label, { ordered: true }),
        key,
        transportGeneration: this.peerGeneration
      };
    } catch (error) {
      throw webrtcFailure("transport", `${channelClass} DataChannel creation failed: ${errorMessage(error)}`);
    }
  }

  private async sendEncrypted<T extends DaemonResponse | DaemonHelloAck>(
    plaintext: DaemonRequest | DaemonHello,
    requestType: string,
    kind: PendingKind,
    parse: (payload: unknown) => T
  ): Promise<T> {
    const channel = this.dataChannel;
    const key = this.cryptoKey;
    if (!channel || !key || channel.readyState !== "open") {
      throw webrtcFailure("transport", "local WebRTC data channel is not open");
    }
    let envelope: AesGcmEnvelope;
    try {
      envelope = await encryptJsonPayload(key, plaintext);
    } catch (error) {
      throw webrtcFailure("encryption", `local WebRTC request encryption failed: ${errorMessage(error)}`);
    }
    return new Promise<T>((resolve, reject) => {
      const generation = this.peerGeneration;
      const timeout = window.setTimeout(() => {
        const error = webrtcFailure("data-plane", `local WebRTC request timed out: ${requestType}`);
        if (kind === "hello") {
          this.failPeerGeneration(generation, error);
          return;
        }
        const index = this.pendingRequests.indexOf(pending);
        if (index >= 0) this.pendingRequests.splice(index, 1);
        if (requestType === "attach") {
          recordLiveHarnessEvent("terminal_attach_timeout", {
            generation,
            session_id: "session_id" in plaintext ? plaintext.session_id : null,
            subscription_id: "subscription_id" in plaintext ? plaintext.subscription_id : null
          });
        }
        pending.reject(error);
      }, requestTimeoutMs);

      const pending: PendingRequest = {
        generation,
        requestType,
        kind,
        request: plaintext,
        resolve: (response) => {
          window.clearTimeout(timeout);
          resolve(parse(response));
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      };
      this.pendingRequests.push(pending);

      try {
        channel.send(JSON.stringify(envelope));
        if (!this.encryptedStreamReady && kind !== "hello") {
          this.encryptedStreamReady = true;
          this.emitLifecycle({ type: "encrypted-stream-ready", requestType });
        }
      } catch (error) {
        const index = this.pendingRequests.indexOf(pending);
        if (index >= 0) this.pendingRequests.splice(index, 1);
        pending.reject(
          webrtcFailure("data-plane", `local WebRTC data-plane send failed for ${requestType}: ${errorMessage(error)}`)
        );
      }
    });
  }

  private async sendHello(generation: number): Promise<DaemonHelloAck> {
    if (generation !== this.peerGeneration) {
      throw webrtcFailure("transport", "local WebRTC hello targeted a stale peer generation");
    }
    if (this.helloPromise) return this.helloPromise;
    const hello: DaemonHello = {
      protocol: hostHelloProtocol,
      compatibility: hostCompatibilityRequirement,
      terminal_compatibility: terminalCompatibilityRequirement
    };
    recordLiveHarnessEvent("daemon_hello", hello);
    this.helloPromise = this.sendEncrypted<DaemonHelloAck>(hello, "hello", "hello", (payload) => {
      const ack = payload as DaemonHelloAck;
      if (!ack || typeof ack.protocol !== "string" || !ack.compatibility) {
        throw webrtcFailure("data-plane", "local WebRTC hello ack is not a DaemonHelloAck");
      }
      return ack;
    }).then((ack) => {
      const terminalCompatible = isTerminalCompatibilityAccepted(ack.terminal_compatibility);
      const detail = terminalCompatible
        ? `Host Hello accepted protocol ${ack.compatibility.protocol} v${ack.compatibility.protocol_version}; terminal plane is compatible.`
        : `Terminal compatibility rejected: ${describeTerminalCompatibility(ack.terminal_compatibility)}. Host operations remain available.`;
      this.emitLifecycle({
        type: "hello-ack",
        hostCompatible: true,
        terminalCompatible,
        detail
      });
      if (!this.encryptedStreamReady) {
        this.encryptedStreamReady = true;
        this.emitLifecycle({ type: "encrypted-stream-ready", requestType: "hello" });
      }
      recordLiveHarnessEvent("daemon_hello_ack", {
        protocol: ack.protocol,
        host_protocol: ack.compatibility.protocol,
        host_protocol_version: ack.compatibility.protocol_version,
        terminal_compatible: terminalCompatible,
        terminal_protocol: ack.terminal_compatibility?.protocol ?? null
      });
      return ack;
    });
    return this.helloPromise;
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
        if (subscription.channel) this.closeSubscriptionChannel(subscription.channel);
        const subscriptionId = subscription.subscriptionId;
        if (subscriptionId) {
          void this.request({ type: "unsubscribe_entities", subscription_id: subscriptionId }).catch(() => undefined);
        }
      }
    };
  }

  subscribePackageEvents(
    spec: { owner: string; name: string; subjects: string[] },
    listener: (event: DaemonEvent) => void
  ): { ready: Promise<void>; unsubscribe(): void } {
    const holder: PackageEventHolder = {
      owner: spec.owner,
      name: spec.name,
      subjects: spec.subjects,
      listener,
      resubscribing: false,
      closed: false
    };
    this.packageEventHolders.add(holder);
    const ready = this.ensurePackageEventSubscription(holder);

    return {
      ready,
      unsubscribe: () => {
        if (holder.closed) return;
        holder.closed = true;
        this.packageEventHolders.delete(holder);
        if (holder.channel) this.closeSubscriptionChannel(holder.channel);
        const subscriptionId = holder.subscriptionId;
        if (subscriptionId) {
          void this.request({ type: "unsubscribe_events", subscription_id: subscriptionId }).catch(() => undefined);
        }
      }
    };
  }

  private connect(): Promise<void> {
    if (this.disconnected) {
      throw webrtcFailure("transport", "local WebRTC transport is disconnected");
    }
    if (
      this.dataChannel?.readyState === "open" &&
      this.cryptoKey &&
      this.encryptedStreamReady
    ) {
      return Promise.resolve();
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

  /**
   * Closes the live data channel so the client takes its ordinary transport-loss path and
   * reconnects in place, without navigating. Only reachable when the live-protocol harness
   * global is installed, and it drives the real channel rather than simulating one, so it
   * cannot substitute for production behaviour. Same seam pattern as the harness terminal
   * controls in TerminalViewHost.
   *
   * This is the reconnect proof only. Ordered sequence_gap proof uses
   * {@link armDropNextInboundEntityFrame} instead.
   */
  closeDataChannelForLiveHarness(): boolean {
    if (!liveHarnessInstalled()) return false;
    const dataChannel = this.dataChannel;
    if (!dataChannel || dataChannel.readyState === "closed") return false;
    dataChannel.close?.();
    return true;
  }

  /**
   * Arms a one-shot drop of the next matching inbound entity delta after decrypt/assembly
   * and before production {@link receiveEntityFrame}. Returns arm outcome only — does not
   * claim a frame was dropped. Fail-closed without harness global / open peer / valid filter.
   */
  armDropNextInboundEntityFrame(
    filter: DropNextInboundEntityFrameFilter,
    options?: { timeout_ms?: number }
  ): DropNextInboundEntityFrameArmResult {
    if (!liveHarnessInstalled()) {
      return { ok: false, state: "not_armed", reason: "no_harness" };
    }
    const dataChannel = this.dataChannel;
    if (!dataChannel || dataChannel.readyState === "closed") {
      return { ok: false, state: "not_armed", reason: "no_peer" };
    }
    if (this.dropNextInboundEntityFrameState.state === "armed") {
      return { ok: false, state: "not_armed", reason: "already_armed" };
    }
    const normalized = normalizeDropFilter(filter);
    if (!normalized) {
      return { ok: false, state: "not_armed", reason: "invalid_filter" };
    }
    const timeoutMs =
      typeof options?.timeout_ms === "number" && Number.isFinite(options.timeout_ms) && options.timeout_ms > 0
        ? options.timeout_ms
        : DROP_NEXT_INBOUND_ENTITY_FRAME_ARM_TIMEOUT_MS;
    this.clearDropNextInboundEntityFrameTimeout();
    const armedAt = Date.now();
    this.dropNextInboundEntityFrameState = {
      state: "armed",
      filter: normalized,
      armed_at: armedAt
    };
    this.dropNextInboundEntityFrameTimeout = window.setTimeout(() => {
      if (this.dropNextInboundEntityFrameState.state !== "armed") return;
      if (this.dropNextInboundEntityFrameState.armed_at !== armedAt) return;
      const armedFilter = this.dropNextInboundEntityFrameState.filter;
      this.dropNextInboundEntityFrameTimeout = undefined;
      this.dropNextInboundEntityFrameState = {
        state: "timed_out",
        filter: armedFilter,
        armed_at: armedAt,
        timed_out_at: Date.now()
      };
    }, timeoutMs);
    return { ok: true, state: "armed", filter: normalized };
  }

  getDropNextInboundEntityFrameState(): DropNextInboundEntityFrameState {
    return this.dropNextInboundEntityFrameState;
  }

  /**
   * Clears an armed drop without consuming a frame. Returns true when a prior arm was cleared.
   */
  disarmDropNextInboundEntityFrame(): boolean {
    if (!liveHarnessInstalled()) return false;
    if (this.dropNextInboundEntityFrameState.state !== "armed") return false;
    this.clearDropNextInboundEntityFrameTimeout();
    this.dropNextInboundEntityFrameState = { state: "disarmed", reason: "manual" };
    return true;
  }

  private clearDropNextInboundEntityFrameTimeout(): void {
    if (this.dropNextInboundEntityFrameTimeout === undefined) return;
    window.clearTimeout(this.dropNextInboundEntityFrameTimeout);
    this.dropNextInboundEntityFrameTimeout = undefined;
  }

  /**
   * When armed and the assembled frame matches the filter, consume the arm, record the
   * intentional harness_drop event, and skip production receiveEntityFrame.
   */
  private maybeDropArmedInboundEntityFrame(frame: DaemonEntityFrame, generation: number): boolean {
    const state = this.dropNextInboundEntityFrameState;
    if (state.state !== "armed") return false;
    if (!dropFilterAllowsFrame(state.filter, frame)) return false;

    this.clearDropNextInboundEntityFrameTimeout();
    const snapshotSeq =
      "snapshot_seq" in frame && typeof frame.snapshot_seq === "number" ? frame.snapshot_seq : -1;
    this.dropNextInboundEntityFrameState = {
      state: "dropped",
      filter: state.filter,
      entity_type: frame.entity_type,
      subscription_id: frame.subscription_id,
      frame_type: frame.type,
      snapshot_seq: snapshotSeq,
      generation,
      dropped_at: Date.now()
    };
    recordLiveHarnessEvent("webrtc_entity_frame_harness_drop", {
      reason: "harness_armed_drop",
      entity_type: frame.entity_type,
      subscription_id: frame.subscription_id,
      frame_type: frame.type,
      snapshot_seq: snapshotSeq,
      generation,
      filter: state.filter
    });
    return true;
  }

  private async open(): Promise<void> {
    this.peerFailed = false;
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
      const shouldReconnect = this.hasReconnectDemand();
      this.emitLifecycle({ type: "data-channel-closed" });
      this.handleTransportClosed(
        webrtcFailure("transport", "local WebRTC data channel closed"),
        shouldReconnect
      );
    });
    dataChannel.addEventListener("error", () => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      recordLiveHarnessEvent("webrtc_data_channel", { state: "error" });
      const shouldReconnect = this.hasReconnectDemand();
      this.emitLifecycle({ type: "data-channel-error" });
      this.handleTransportClosed(
        webrtcFailure("transport", "local WebRTC data channel failed"),
        shouldReconnect
      );
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
    await this.sendHello(generation);
    queueMicrotask(() => {
      for (const subscription of this.entitySubscriptions) {
        void this.startEntitySubscription(subscription, generation);
      }
      for (const holder of this.packageEventHolders) {
        void this.startPackageEventSubscription(holder, generation);
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
          if (!applyAssemblyTimeoutCleanup) return;
          const error = webrtcFailure(
            "data-plane",
            `local WebRTC ${chunk.delivery_kind} assembly timed out${pending ? `: ${pending.requestType}` : ""}`
          );
          if (pending?.requestType === "attach") {
            const timedAssembly = this.responseAssemblies.get(chunk.message_id);
            if (timedAssembly && timedAssembly === assembly) {
              this.releaseAssembly(chunk.message_id, timedAssembly);
            }
            const pendingIndex = this.pendingRequests.indexOf(pending);
            if (pendingIndex >= 0) this.pendingRequests.splice(pendingIndex, 1);
            pending.reject(error);
            recordLiveHarnessEvent("terminal_attach_response_timeout", {
              generation,
              message_id: chunk.message_id
            });
            return;
          }
          this.failPeerGeneration(generation, error);
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

    let envelopeJson = "";
    for (let index = 0; index < assembly.chunkCount; index += 1) {
      envelopeJson += assembly.chunks.get(index) as string;
    }
    if (utf8ByteLength(envelopeJson) !== assembly.totalBytes) {
      throw webrtcFailure("data-plane", "local WebRTC response assembly is not byte-exact");
    }

    const key = this.cryptoKey;
    if (!key) throw webrtcFailure("encryption", "local WebRTC response key is unavailable");

    let payload: unknown;
    try {
      payload = await decryptDaemonPayload(key, envelopeJson);
    } catch (error) {
      throw webrtcFailure("encryption", `local WebRTC response decryption failed: ${errorMessage(error)}`);
    }
    if (generation !== this.peerGeneration) return;
    this.releaseAssembly(chunk.message_id, assembly);
    this.retainCompletedMessageId(chunk.message_id);
    const finishedAt = Date.now();
    if (assembly.deliveryKind === "daemon_entity_frame") {
      throw webrtcFailure("data-plane", "control DataChannel received an entity delivery");
    }
    if (assembly.deliveryKind === "daemon_terminal_frame") {
      throw webrtcFailure("data-plane", "control DataChannel received a terminal delivery");
    }
    if (assembly.deliveryKind === "daemon_event") {
      recordLiveHarnessEvent("webrtc_daemon_event_assembly", {
        generation,
        total_bytes: assembly.totalBytes,
        chunk_count: assembly.chunkCount,
        started_at: assembly.startedAt,
        finished_at: finishedAt,
        duration_ms: finishedAt - assembly.startedAt
      });
      await this.receiveHostEvent(payload, generation);
      return;
    }

    let pending = assembly.pending;
    if (pending && !pendingMatchesResponse(pending, payload)) {
      pending.messageId = undefined;
      pending = undefined;
    }
    pending ??= this.pendingRequests.find(
      (entry) =>
        entry.generation === generation &&
        entry.messageId === undefined &&
        pendingMatchesResponse(entry, payload)
    );
    if (!pending) {
      if (isStaleTerminalReservationResponse(payload)) {
        recordLiveHarnessEvent("stale_control_response", {
          response_kind: payload.kind,
          session_id: payload.terminal_reservation?.session_id ?? null,
          subscription_id: payload.terminal_reservation?.subscription_id ?? null,
          generation: payload.terminal_reservation?.generation ?? null,
          peer_generation: payload.terminal_reservation?.peer_generation ?? null
        });
        return;
      }
      throw webrtcFailure("data-plane", "local WebRTC daemon response assembly lost its pending request");
    }
    const pendingIndex = this.pendingRequests.indexOf(pending);
    if (pendingIndex >= 0) this.pendingRequests.splice(pendingIndex, 1);
    recordLiveHarnessEvent("webrtc_response_assembly", {
      request_type: pending.requestType,
      generation,
      total_bytes: assembly.totalBytes,
      chunk_count: assembly.chunkCount,
      started_at: assembly.startedAt,
      finished_at: finishedAt,
      duration_ms: finishedAt - assembly.startedAt
    });
    pending.resolve(payload as DaemonResponse | DaemonHelloAck);
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
    if (generation !== this.peerGeneration || this.peerFailed) return;
    this.peerFailed = true;
    // Snapshot before emitLifecycle. HubTerminalDataPlane.handleTransportLost
    // abandons the current stream and removes its TerminalStreamListener.
    const shouldReconnect = this.hasReconnectDemand();
    this.emitLifecycle({ type: "data-channel-error" });
    this.handleTransportClosed(error, shouldReconnect);
  }

  private failPending(error: unknown): void {
    for (const pending of this.pendingRequests.splice(0)) {
      pending.reject(error);
    }
  }

  private hasReconnectDemand(): boolean {
    return (
      this.entitySubscriptions.size > 0 ||
      this.packageEventHolders.size > 0 ||
      this.terminalStreamListeners.size > 0
    );
  }

  private handleTransportClosed(error: unknown, shouldReconnect = this.hasReconnectDemand()): void {
    this.resetPeerState();
    this.failPending(error);
    if (!this.disconnected && shouldReconnect) {
      queueMicrotask(() => void this.reconnectEntitySubscriptions());
    }
  }

  private resetPeerState(): void {
    const dataChannel = this.dataChannel;
    const peerConnection = this.peerConnection;
    for (const binding of [...this.terminalChannels]) {
      this.closeTerminalChannel(binding);
    }
    for (const binding of [...this.subscriptionChannels]) {
      this.closeSubscriptionChannel(binding);
    }
    this.dataChannel = undefined;
    this.peerConnection = undefined;
    this.connectPromise = undefined;
    this.cryptoKey = undefined;
    this.encryptedStreamReady = false;
    this.helloPromise = undefined;
    this.clearAssemblies();
    if (this.dropNextInboundEntityFrameState.state === "armed") {
      this.clearDropNextInboundEntityFrameTimeout();
      this.dropNextInboundEntityFrameState = { state: "disarmed", reason: "peer_reset" };
    }
    for (const subscription of this.entitySubscriptions) {
      subscription.generation = undefined;
      subscription.subscriptionId = undefined;
      subscription.snapshotSeq = undefined;
      subscription.resubscribing = false;
      subscription.channel = undefined;
    }
    for (const holder of this.packageEventHolders) {
      holder.generation = undefined;
      holder.subscriptionId = undefined;
      holder.channel = undefined;
      holder.resubscribing = false;
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
      if (subscription.closed || subscription.generation !== generation || subscription.subscriptionId !== subscriptionId) {
        return;
      }
      if (response.error) throw new Error(response.error.message);
      if (response.kind !== "entity_subscribed") {
        throw new Error(`entity subscription returned ${response.kind}`);
      }
      const reservation = response.subscription_reservation;
      if (!reservation) {
        const error = webrtcFailure("data-plane", "entity subscription response omitted its reservation");
        this.emitSubscriptionChannelFailure(
          { channelClass: "entity", subscriptionId },
          "reservation_missing",
          error
        );
        throw error;
      }
      return this.openSubscriptionChannel(subscription, reservation, "entity");
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

  private ensurePackageEventSubscription(holder: PackageEventHolder): Promise<void> {
    return this.connect().then(() => this.startPackageEventSubscription(holder, this.peerGeneration));
  }

  private startPackageEventSubscription(holder: PackageEventHolder, generation: number): Promise<void> {
    if (holder.closed || generation !== this.peerGeneration) return Promise.resolve();
    if (holder.generation === generation && holder.ready) return holder.ready;

    const subscriptionId = this.options.eventSubscriptionIdGenerator?.(
      { owner: holder.owner, name: holder.name },
      generation
    ) ?? crypto.randomUUID();
    holder.generation = generation;
    holder.subscriptionId = subscriptionId;
    if (!holder.ready) {
      holder.ready = new Promise<void>((resolve, reject) => {
        holder.resolveReady = resolve;
        holder.rejectReady = reject;
      });
    }
    recordLiveHarnessEvent("webrtc_package_event_subscription", {
      state: "requested",
      owner: holder.owner,
      name: holder.name,
      subjects: holder.subjects,
      subscription_id: subscriptionId,
      generation
    });
    void this.request({
      type: "subscribe_events",
      subscription_id: subscriptionId,
      owner: holder.owner,
      name: holder.name,
      subjects: holder.subjects
    }).then((response) => {
      if (holder.closed || holder.generation !== generation || holder.subscriptionId !== subscriptionId) {
        return;
      }
      if (response.error) throw new Error(response.error.message);
      if (response.kind !== "event_subscribed") {
        throw new Error(`event subscription returned ${response.kind}`);
      }
      const reservation = response.subscription_reservation;
      if (!reservation) {
        const error = webrtcFailure("data-plane", "package-event subscription response omitted its reservation");
        this.emitSubscriptionChannelFailure(
          { channelClass: "package_event", subscriptionId },
          "reservation_missing",
          error
        );
        throw error;
      }
      return this.openSubscriptionChannel(holder, reservation, "package_event").then(() => {
        if (!holder.closed && holder.subscriptionId === subscriptionId && holder.generation === generation) {
          recordLiveHarnessEvent("webrtc_package_event_subscription", {
            state: "ready",
            owner: holder.owner,
            name: holder.name,
            subjects: holder.subjects,
            subscription_id: subscriptionId,
            generation,
            reservation_generation: holder.channel?.generation ?? null,
            label: holder.channel?.label ?? null
          });
          holder.resolveReady?.();
        }
      });
    }).catch((error: unknown) => {
      if (holder.closed || holder.generation !== generation || holder.subscriptionId !== subscriptionId) {
        return;
      }
      holder.rejectReady?.(error);
      recordLiveHarnessEvent("webrtc_package_event_subscription_error", {
        stage: "subscribe",
        owner: holder.owner,
        name: holder.name,
        subscription_id: subscriptionId,
        generation,
        message: errorMessage(error)
      });
    });
    return holder.ready;
  }

  private async receiveHostEvent(payload: unknown, generation: number): Promise<void> {
    if (generation !== this.peerGeneration) {
      recordLiveHarnessEvent("webrtc_daemon_event_discarded", {
        reason: "stale_peer_generation",
        generation
      });
      return;
    }
    const event = payload as DaemonEvent;
    if (event.type === "package_event" || event.type === "event_gap") {
      throw webrtcFailure("data-plane", "control DataChannel received a package-event delivery");
    }
    recordLiveHarnessEvent("daemon_event", event);
    if (event.type === "terminal_subscription_closed") {
      const listeners = [...this.terminalStreamListeners].filter(
        (listener) =>
          !listener.closed &&
          listener.sessionId === event.session_id &&
          listener.subscriptionId === event.subscription_id &&
          listener.coreGeneration === event.generation
      );
      if (listeners.length === 0) {
        recordLiveHarnessEvent("webrtc_daemon_event_discarded", {
          reason: "stale_generation_or_subscription",
          generation,
          session_id: event.session_id,
          subscription_id: event.subscription_id,
          core_generation: event.generation
        });
        return;
      }
      for (const listener of listeners) {
        try {
          await listener.onEvent(event);
        } finally {
          this.removeTerminalStreamListener(listener);
        }
      }
      return;
    }
  }

  private receivePackageEvent(binding: PackageEventChannelBinding, event: PackageEvent): void {
    const holder = binding.owner;
    if (
      holder.closed ||
      holder.channel !== binding ||
      holder.generation !== binding.transportGeneration ||
      holder.subscriptionId !== event.subscription_id ||
      holder.owner !== event.owner ||
      holder.name !== event.name
    ) {
      recordLiveHarnessEvent("webrtc_daemon_event_discarded", {
        reason: "stale_generation_or_subscription",
        generation: binding.transportGeneration,
        subscription_id: event.subscription_id,
        owner: event.owner,
        name: event.name,
        type: event.type
      });
      return;
    }
    recordLiveHarnessEvent("daemon_event", {
      ...event,
      label: binding.label
    });
    holder.listener(event);
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

    if (frame.type === "entity_error") {
      recordLiveHarnessEvent("webrtc_entity_subscription", {
        state: "error",
        entity_type: frame.entity_type,
        subscription_id: frame.subscription_id,
        generation,
        code: frame.code,
        message: frame.message
      });
      subscription.listener(frame);
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
        reservation_generation: subscription.channel?.generation ?? null,
        label: subscription.channel?.label ?? null,
        snapshot_seq: frame.snapshot_seq,
        resync_reason: frame.resync_reason ?? null
      });
      subscription.listener(frame);
      return;
    }

    const currentSequence = subscription.snapshotSeq;
    if (currentSequence === undefined || frame.snapshot_seq !== currentSequence + 1) {
      void this.resubscribeEntity(
        subscription,
        generation,
        currentSequence === undefined ? "delta_before_snapshot" : "sequence_gap",
        {
          rejected_snapshot_seq: frame.snapshot_seq,
          rejected_frame_type: frame.type,
          current_snapshot_seq: currentSequence ?? null
        }
      );
      return;
    }

    subscription.snapshotSeq = frame.snapshot_seq;
    subscription.listener(frame);
  }

  private async resubscribeEntity(
    subscription: EntitySubscription,
    generation: number,
    reason: string,
    correlation: {
      rejected_snapshot_seq?: number;
      rejected_frame_type?: string;
      current_snapshot_seq?: number | null;
    } = {}
  ): Promise<void> {
    if (subscription.resubscribing || subscription.closed || generation !== this.peerGeneration) return;
    subscription.resubscribing = true;
    const previousSubscriptionId = subscription.subscriptionId;
    recordLiveHarnessEvent("webrtc_entity_frame_discarded", {
      reason,
      generation,
      subscription_id: previousSubscriptionId,
      entity_type: subscription.entityType,
      ...(correlation.rejected_snapshot_seq !== undefined
        ? { rejected_snapshot_seq: correlation.rejected_snapshot_seq }
        : {}),
      ...(correlation.rejected_frame_type !== undefined
        ? { rejected_frame_type: correlation.rejected_frame_type }
        : {}),
      ...(correlation.current_snapshot_seq !== undefined
        ? { current_snapshot_seq: correlation.current_snapshot_seq }
        : {})
    });
    try {
      if (subscription.channel) this.closeSubscriptionChannel(subscription.channel);
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

  private async resubscribePackageEvent(
    holder: PackageEventHolder,
    generation: number
  ): Promise<void> {
    if (holder.resubscribing || holder.closed || generation !== this.peerGeneration) return;
    holder.resubscribing = true;
    const previousSubscriptionId = holder.subscriptionId;
    try {
      if (holder.channel) this.closeSubscriptionChannel(holder.channel);
      if (previousSubscriptionId) {
        await this.request({ type: "unsubscribe_events", subscription_id: previousSubscriptionId }).catch(() => undefined);
      }
      holder.generation = undefined;
      holder.subscriptionId = undefined;
      holder.ready = undefined;
      holder.resolveReady = undefined;
      holder.rejectReady = undefined;
      await this.startPackageEventSubscription(holder, generation);
    } finally {
      holder.resubscribing = false;
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

function subscriptionChannelOwnerPayload(binding: SubscriptionChannelBinding): Record<string, unknown> {
  if (binding.channelClass === "entity") {
    return { entity_type: binding.owner.entityType };
  }
  return {
    owner: binding.owner.owner,
    name: binding.owner.name,
    subjects: binding.owner.subjects
  };
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
  if (
    chunk.delivery_kind !== "daemon_response" &&
    chunk.delivery_kind !== "daemon_entity_frame" &&
    chunk.delivery_kind !== "daemon_terminal_frame" &&
    chunk.delivery_kind !== "daemon_event"
  ) {
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

async function encryptJsonPayload(key: CryptoKey, payload: unknown): Promise<AesGcmEnvelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(nonce) }, key, plaintext);
  return {
    nonce: base64Encode(nonce),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
    version: 1
  };
}

async function encryptBytesPayload(key: CryptoKey, payload: Uint8Array): Promise<AesGcmEnvelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce) },
    key,
    toArrayBuffer(payload)
  );
  return {
    nonce: base64Encode(nonce),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
    version: 1
  };
}

function parseTerminalEvent(value: unknown): TerminalEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw webrtcFailure("data-plane", "terminal frame must be a JSON object");
  }
  const type = (value as { type?: unknown }).type;
  if (
    type !== "snapshot" &&
    type !== "terminal_output" &&
    type !== "process_exit" &&
    type !== "attach_state" &&
    type !== "input_result"
  ) {
    throw webrtcFailure("data-plane", `unsupported terminal frame type ${String(type)}`);
  }
  return value as TerminalEvent;
}

function pendingMatchesResponse(pending: PendingRequest, value: unknown): boolean {
  if (pending.kind === "hello") {
    return Boolean(value && typeof value === "object" && "protocol" in value && "compatibility" in value);
  }
  if (pending.requestType !== "attach") {
    return !isStaleTerminalReservationResponse(value);
  }
  if (!("type" in pending.request) || pending.request.type !== "attach") {
    return false;
  }
  if (isOperatorErrorResponse(value)) return true;
  if (!isStaleTerminalReservationResponse(value)) return false;
  const reservation = value.terminal_reservation;
  return Boolean(
    reservation &&
    reservation.session_id === pending.request.session_id &&
    reservation.subscription_id === pending.request.subscription_id
  );
}

function isOperatorErrorResponse(value: unknown): value is DaemonResponse {
  return Boolean(
    value &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "operator_error" &&
    "error" in value &&
    value.error
  );
}

function isStaleTerminalReservationResponse(value: unknown): value is DaemonResponse {
  return Boolean(
    value &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "terminal_reservation"
  );
}

function isTerminalBodyEvent(event: DaemonEvent): boolean {
  return (
    event.type === "snapshot" ||
    event.type === "terminal_output" ||
    event.type === "process_exit" ||
    event.type === "attach_state" ||
    event.type === "scrollback"
  );
}

function isTerminalCompatibilityAccepted(
  compatibility: DaemonHelloAck["terminal_compatibility"]
): boolean {
  if (!compatibility) return false;
  if (compatibility.protocol !== terminalCompatibilityRequirement.protocol) return false;
  if (compatibility.protocol_version < terminalCompatibilityRequirement.protocol_version) return false;
  if (compatibility.conformance_fixture_revision < terminalCompatibilityRequirement.minimum_conformance_fixture_revision) {
    return false;
  }
  return terminalCompatibilityRequirement.required_features.every((feature) =>
    compatibility.features.includes(feature)
  );
}

function describeTerminalCompatibility(
  compatibility: DaemonHelloAck["terminal_compatibility"]
): string {
  if (!compatibility) return "DaemonHelloAck omitted terminal_compatibility";
  return `${compatibility.protocol} v${compatibility.protocol_version} rev ${compatibility.conformance_fixture_revision}`;
}

async function decryptDaemonPayload(
  key: CryptoKey,
  envelopeJson: string
): Promise<unknown> {
  const envelope = JSON.parse(envelopeJson) as AesGcmEnvelope;
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64Decode(envelope.nonce)) },
    key,
    toArrayBuffer(base64Decode(envelope.ciphertext))
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
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

/**
 * Exposes live-protocol harness transport controls when the harness global is already
 * present:
 * - closeDataChannel — in-place reconnect on a surviving document (not ordered-gap)
 * - armDropNextInboundEntityFrame / getDropNextInboundEntityFrameState /
 *   disarmDropNextInboundEntityFrame — intentional one-shot drop of a real inbound entity
 *   delta so production sequence_gap resubscribe can be proven without store injection
 */
function installLiveHarnessTransportControl(
  transport: WebrtcDaemonTransport,
  client: DaemonBridgeClient
): void {
  if (!liveHarnessInstalled()) return;

  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      transportControl?: {
        closeDataChannel(): boolean;
        request(request: DaemonRequest): Promise<DaemonResponse>;
        streamTerminal(
          sessionId: string,
          subscriptionId: string,
          onEvent: (event: TerminalStreamEvent) => void | Promise<void>
        ): { ready: Promise<void>; abandon(): void; unsubscribe(): void };
        armDropNextInboundEntityFrame(
          filter: DropNextInboundEntityFrameFilter,
          options?: { timeout_ms?: number }
        ): DropNextInboundEntityFrameArmResult;
        getDropNextInboundEntityFrameState(): DropNextInboundEntityFrameState;
        disarmDropNextInboundEntityFrame(): boolean;
      };
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  if (!harness) return;

  harness.transportControl = {
    closeDataChannel: () => transport.closeDataChannelForLiveHarness(),
    request: (request) => transport.request(request),
    streamTerminal: (sessionId, subscriptionId, onEvent) => {
      if (!client.streamTerminal) {
        throw new Error("WebRTC client does not expose terminal streaming.");
      }
      return client.streamTerminal(sessionId, subscriptionId, onEvent);
    },
    armDropNextInboundEntityFrame: (filter, options) =>
      transport.armDropNextInboundEntityFrame(filter, options),
    getDropNextInboundEntityFrameState: () => transport.getDropNextInboundEntityFrameState(),
    disarmDropNextInboundEntityFrame: () => transport.disarmDropNextInboundEntityFrame()
  };
}

function liveHarnessInstalled(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      (window as typeof window & { __BOTSTER_LIVE_PROTOCOL_HARNESS__?: unknown })
        .__BOTSTER_LIVE_PROTOCOL_HARNESS__
    )
  );
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
