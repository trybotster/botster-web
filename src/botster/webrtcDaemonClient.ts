import {
  LOCAL_WEBRTC_DELIVERY_CHUNK_VERSION,
  LOCAL_WEBRTC_MAX_DELIVERY_BYTES,
  LOCAL_WEBRTC_MAX_FRAME_BYTES,
  LOCAL_WEBRTC_TERMINAL_CHUNK_MAX_PLAINTEXT_BYTES,
  LOCAL_WEBRTC_TERMINAL_CHUNK_HEADER_BYTES,
  LOCAL_WEBRTC_TERMINAL_CHUNK_NONCE_BYTES,
  LOCAL_WEBRTC_TERMINAL_CHUNK_TAG_BYTES
} from "./generated/daemon-protocol";
import type {
  AesGcmEnvelope,
  ClientFrame,
  DaemonBridgeRequestEnvelope,
  DaemonBridgeResponseEnvelope,
  DaemonCloseReason,
  DaemonEntityFrame,
  DaemonEvent,
  DaemonHelloAck,
  DaemonLocalWebrtcBootstrap,
  DaemonLocalWebrtcDeliveryChunk,
  DaemonLocalWebrtcDeliveryKind,
  DaemonRequest,
  DaemonResponse,
  DaemonSubscriptionReservation,
  DaemonTerminalReservation,
  JsonValue,
  ServerFrame
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
  | { type: "hello-ack"; hostCompatible: boolean; terminalCompatible: boolean; detail: string }
  | { type: "reconnect-attempt"; attempt: number; deadlineMs: number }
  | { type: "reconnect-scheduled"; attempt: number; delayMs: number; detail: string };

export const webRtcDaemonLifecycleEventName = "botster:webrtc-daemon-lifecycle";

/**
 * Reconnect policy after a transport loss while the user's connection intent exists. One
 * retry loop with capped exponential delay, 250 ms to 8 s, continues until an authenticated
 * Hello or an explicit disconnect cancels it. Each attempt has an absolute deadline measured
 * from attempt start; the deadline rejects the caller even when a bootstrap provider or
 * fetch ignores cancellation.
 */
export const localWebrtcReconnectPolicy = Object.freeze({
  initialDelayMs: 250,
  maxDelayMs: 8_000,
  attemptTimeoutMs: 10_000
});

/**
 * Host-control v10 request bounds. Hub answers a valid 33rd outstanding request with a
 * correlated `too_many_requests` error, so the client holds the 33rd locally until a slot
 * frees. Request ids are decimal u64 strings, strictly increasing per connection generation.
 */
export const hostControlRequestLimits = Object.freeze({
  /** Host-control v10: at most 32 requests outstanding per connection generation. */
  maxOutstandingRequests: 32,
  /** Web policy: callers held for a slot beyond this count are refused, never queued without bound. */
  maxWaitingRequests: 256
});

/** The connection a request belongs to, fixed before any async work and re-checked after each await. */
type SendTarget = {
  readonly generation: number;
  readonly channel: RTCDataChannel;
  readonly key: CryptoKey;
};

/** One reserved outstanding-request slot; released exactly once by whoever holds it. */
type RequestSlot = {
  readonly generation: number;
  release(): void;
};

/**
 * One connection attempt. `generation` is the canonical attempt identity: it is allocated
 * before the first await and equals `peerGeneration` only while the attempt owns the client.
 * Timer, abort controller, and peer resources belong to the attempt and are cleared by identity.
 */
type ConnectAttempt = {
  generation: number;
  promise: Promise<void>;
  resolve(): void;
  reject(error: unknown): void;
  settled: boolean;
  deadlineTimer: number | undefined;
  abort: AbortController | undefined;
  peerConnection: RTCPeerConnection | undefined;
  dataChannel: RTCDataChannel | undefined;
};

type PendingKind = "hello" | "request";

type PendingRequest = {
  generation: number;
  /** Decimal u64 envelope id; the Hello has no id and uses the empty string. */
  requestId: string;
  requestType: string;
  kind: PendingKind;
  /** The outstanding slot this request holds until it settles; the Hello holds none. */
  slot?: RequestSlot;
  resolve(response: DaemonResponse | DaemonHelloAck): void;
  reject(error: unknown): void;
};

function pendingKey(generation: number, requestId: string): string {
  return `${generation}:${requestId}`;
}

type TerminalStreamListener = {
  sessionId: string;
  subscriptionId: string;
  peerGeneration: number;
  /** Core generation from the terminal HelloAck; undefined until admission, so no close matches. */
  coreGeneration: number | undefined;
  closed: boolean;
  onEvent(event: TerminalStreamEvent): void | Promise<void>;
};

/** One in-progress binary terminal message: decrypted slices land in place, in order. */
type TerminalChannelAssembly = {
  messageId: bigint;
  chunkCount: number;
  totalBytes: number;
  /** Fixed attachment generation and stream epoch; every chunk of one message repeats both. */
  generation: bigint;
  streamEpoch: number;
  nextIndex: number;
  body: Uint8Array;
  receivedBytes: number;
  timeout: number;
};

type TerminalChannelBinding = {
  listener: TerminalStreamListener;
  channel: RTCDataChannel;
  peerGeneration: number;
  transportGeneration: number;
  /** Core generation from the terminal HelloAck (terminal_generation); set before admitted. */
  generation: number | undefined;
  label: string;
  closed: boolean;
  admitted: boolean;
  /** Hub's typed reject for this reservation, preferred over the close it causes. */
  rejection?: WebrtcDaemonClientError;
  /** Per-channel, per-direction message counters; strictly increasing. */
  outboundMessageId: bigint;
  lastInboundMessageId: bigint;
  assembly?: TerminalChannelAssembly;
  resolveReady(): void;
  rejectReady(error: unknown): void;
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
  /** Hub's typed reject for this reservation, preferred over the close it causes. */
  rejection?: WebrtcDaemonClientError;
  completedMessageIds: Set<string>;
  assembly?: SubscriptionChannelAssembly;
  resolveReady(): void;
  rejectReady(error: unknown): void;
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

export interface WebrtcDaemonRequestFailure {
  code: "local_request_timeout" | "local_request_interrupted";
  request_id: string;
  operation: string;
}

export class WebrtcDaemonClientError extends Error {
  readonly botsterWebrtcStage: WebrtcDaemonFailureStage;
  readonly requestFailure?: WebrtcDaemonRequestFailure;
  /** Hub's typed reserved-channel reject, when the Hub refused this channel. */
  channelRejection?: SubscriptionChannelRejection;

  constructor(stage: WebrtcDaemonFailureStage, message: string, requestFailure?: WebrtcDaemonRequestFailure) {
    super(message);
    this.name = "WebrtcDaemonClientError";
    this.botsterWebrtcStage = stage;
    this.requestFailure = requestFailure;
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

/**
 * Bound on raw DataChannel messages admitted per channel ahead of decode. Each channel
 * decodes its messages in order on one promise chain; a peer that sends faster than the
 * client decrypts would otherwise grow that chain without limit. Overflow retires the
 * channel's route: the terminal or subscription channel closes, or the control connection
 * fails, and the ordinary recovery path follows.
 */
export const localWebrtcInboundAdmissionLimits = Object.freeze({
  maximumQueuedFrames: 256,
  maximumQueuedBytes: 8 * 1_024 * 1_024
});

type InboundAdmission = { frames: number; bytes: number };

/** Raw message size for admission accounting; the handler still enforces the exact frame bound. */
function inboundFrameBytes(data: unknown): number {
  if (typeof data === "string") return data.length;
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return data.byteLength;
  return 0;
}

/** Reserves admission for one raw message; false leaves the accounting unchanged. */
function admitInboundFrame(admission: InboundAdmission, bytes: number): boolean {
  if (
    admission.frames + 1 > localWebrtcInboundAdmissionLimits.maximumQueuedFrames ||
    admission.bytes + bytes > localWebrtcInboundAdmissionLimits.maximumQueuedBytes
  ) {
    return false;
  }
  admission.frames += 1;
  admission.bytes += bytes;
  return true;
}

function releaseInboundFrame(admission: InboundAdmission, bytes: number): void {
  admission.frames -= 1;
  admission.bytes -= bytes;
}

function inboundAdmissionFailure(channel: string, admission: InboundAdmission): WebrtcDaemonClientError {
  return webrtcFailure(
    "data-plane",
    `${channel} DataChannel inbound admission exceeded ${admission.frames} queued frames and ${admission.bytes} queued bytes`
  );
}

/**
 * Binary terminal chunk layout (Hub host-control v10), 33-byte header:
 * offset 0 `u8 version=2`; 1 `u64 LE message_id` (per channel, per direction, from 1);
 * 9 `u32 LE chunk_index`; 13 `u32 LE chunk_count`; 17 `u32 LE total_bytes` (plaintext length);
 * 21 `u64 LE generation` (fixed attachment generation from the reservation);
 * 29 `u32 LE stream_epoch` (Core routing metadata; 0 in the input direction);
 * 33 12-byte nonce; 45 AES-GCM ciphertext || 16-byte tag.
 * The route is the subscription DataChannel label. Every chunk of one message repeats
 * generation and stream_epoch; reassembly identity is (channel, direction, message_id).
 */
const terminalChunkHeaderBytes = LOCAL_WEBRTC_TERMINAL_CHUNK_HEADER_BYTES;
const terminalChunkNonceBytes = LOCAL_WEBRTC_TERMINAL_CHUNK_NONCE_BYTES;
const terminalChunkTagBytes = LOCAL_WEBRTC_TERMINAL_CHUNK_TAG_BYTES;
/** Match the Hub InboundTerminalChunkAssembly limit named LOCAL_WEBRTC_CHUNK_PAYLOAD_BYTES. */
export const localWebrtcTerminalChunkLimits = Object.freeze({
  maximumPlaintextBytes: LOCAL_WEBRTC_TERMINAL_CHUNK_MAX_PLAINTEXT_BYTES
});
const terminalChunkPlaintextBytes = localWebrtcTerminalChunkLimits.maximumPlaintextBytes;

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
  const client: DaemonBridgeClient = {
    async request(request) {
      return transport.request(request);
    },
    disconnect() {
      transport.disconnect();
    },
    subscribeLifecycle(onEvent) {
      return transport.subscribeLifecycle(onEvent);
    },
    subscribeEvents(onEvent) {
      return transport.subscribeHostEvents(onEvent);
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
        await onEvent(event);
      });

      const stopDelivery = () => {
        closed = true;
        listener.closed = true;
        transport.removeTerminalStreamListener(listener);
      };

      let binding: TerminalChannelBinding | undefined;
      // Set once the Attach was written to the control channel. A consumer owes Hub a Detach
      // only for an Attach that left; a queued Attach that failed before sending owes nothing.
      let attachSent = false;
      const ready = transport
        .request(
          { type: "attach", session_id: sessionId, subscription_id: subscriptionId },
          // Abandoned before the write: the Attach never leaves, on this peer or a later one.
          { onSent: () => { attachSent = true; }, isCancelled: () => closed }
        )
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
      // A stream abandoned before its reservation is never awaited again, so its attach
      // outcome is observed here once; awaiting callers still receive the same rejection.
      void ready.catch(() => undefined);

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
        get attachSent() { return attachSent; },
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
  /** Pending host requests keyed by `(connection generation, request_id)`. */
  private readonly pendingRequests = new Map<string, PendingRequest>();
  /** Requests waiting for one of the 32 outstanding slots, in submission order. */
  private readonly requestSlotWaiters: Array<{ generation: number; grant(slot: RequestSlot): void; cancel(error: unknown): void }> = [];
  /** Reserved outstanding slots per connection generation, counted at reservation, not at send. */
  private readonly reservedSlots = new Map<number, number>();
  private nextRequestId = 1;
  private peerFailed = false;
  private readonly responseAssemblies = new Map<string, ResponseAssembly>();
  private readonly completedMessageIds = new Set<string>();
  private readonly entitySubscriptions = new Set<EntitySubscription>();
  private readonly packageEventHolders = new Set<PackageEventHolder>();
  private readonly hostEventListeners = new Set<(event: DaemonEvent) => void>();
  /** Direct lifecycle listeners of this transport; each consumer sees only its own transport's events. */
  private readonly lifecycleListeners = new Set<(event: WebrtcDaemonLifecycleEvent) => void>();
  private readonly terminalStreamListeners = new Set<TerminalStreamListener>();
  private readonly terminalChannels = new Set<TerminalChannelBinding>();
  private readonly subscriptionChannels = new Set<SubscriptionChannelBinding>();
  private helloPromise: Promise<DaemonHelloAck> | undefined;
  private peerConnection: RTCPeerConnection | undefined;
  private dataChannel: RTCDataChannel | undefined;
  private cryptoKey: CryptoKey | undefined;
  private connectPromise: Promise<void> | undefined;
  private currentAttempt: ConnectAttempt | undefined;
  private helloGeneration: number | undefined;
  private retryTimer: number | undefined;
  private retryAttempt = 0;
  /** Sticky until an authenticated Hello: captured at loss, before terminal listeners detach. */
  private reconnectDemand = false;
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

  async request(
    request: DaemonRequest,
    options: { onSent?: () => void; isCancelled?: () => boolean } = {}
  ): Promise<DaemonResponse> {
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

    if (options.isCancelled?.()) {
      throw webrtcFailure("transport", `local WebRTC request cancelled before send: ${request.type}`);
    }
    recordLiveHarnessEvent("daemon_request", request);
    // The request belongs to this connection for its whole life: generation, channel, and
    // key are fixed here and re-checked after every await. A request never migrates to a
    // later peer; after a loss it fails and the caller decides whether to resend.
    const target: SendTarget = { generation: this.peerGeneration, channel, key };
    const slot = await this.acquireRequestSlot(target.generation);
    if (options.isCancelled?.()) {
      slot.release();
      throw webrtcFailure("transport", `local WebRTC request cancelled before send: ${request.type}`);
    }
    if (!this.ownsSendTarget(target) || slot.generation !== target.generation) {
      slot.release();
      throw webrtcFailure("transport", `local WebRTC connection changed while ${request.type} waited for a request slot`);
    }
    const requestId = String(this.nextRequestId++);
    const envelope: ClientFrame = { frame: "request", request_id: requestId, request };
    const response = await this.sendEncrypted<DaemonResponse>(
      target,
      envelope,
      requestId,
      request.type,
      "request",
      slot,
      options,
      (payload) => payload as DaemonResponse
    );
    return response;
  }

  /** True while the target's generation is current and its channel is the live open channel. */
  private ownsSendTarget(target: SendTarget): boolean {
    return (
      target.generation === this.peerGeneration &&
      this.dataChannel === target.channel &&
      this.cryptoKey === target.key &&
      target.channel.readyState === "open"
    );
  }

  private reservedSlotCount(generation: number): number {
    return this.reservedSlots.get(generation) ?? 0;
  }

  /** Reserves one slot synchronously; the reservation releases exactly once. */
  private reserveSlot(generation: number): RequestSlot {
    this.reservedSlots.set(generation, this.reservedSlotCount(generation) + 1);
    let released = false;
    return {
      generation,
      release: () => {
        if (released) return;
        released = true;
        const remaining = this.reservedSlotCount(generation) - 1;
        if (remaining <= 0) this.reservedSlots.delete(generation);
        else this.reservedSlots.set(generation, remaining);
        this.grantWaitingSlot();
      }
    };
  }

  /**
   * Acquires one of the 32 outstanding slots for this generation. The slot is reserved
   * synchronously before this method returns or a waiter is resolved, so concurrent callers
   * still encrypting cannot all pass the check. Waiting callers are bounded.
   */
  private acquireRequestSlot(generation: number): Promise<RequestSlot> {
    if (
      this.requestSlotWaiters.length === 0 &&
      this.reservedSlotCount(generation) < hostControlRequestLimits.maxOutstandingRequests
    ) {
      return Promise.resolve(this.reserveSlot(generation));
    }
    if (this.requestSlotWaiters.length >= hostControlRequestLimits.maxWaitingRequests) {
      return Promise.reject(
        webrtcFailure("data-plane", `local WebRTC request queue is full: ${hostControlRequestLimits.maxWaitingRequests} callers already wait for a slot`)
      );
    }
    return new Promise<RequestSlot>((resolve, reject) => {
      this.requestSlotWaiters.push({ generation, grant: resolve, cancel: reject });
    });
  }

  /** Hands a freed slot to the first waiter of the current generation, reserving it for them. */
  private grantWaitingSlot(): void {
    while (this.requestSlotWaiters.length > 0) {
      const waiter = this.requestSlotWaiters[0];
      if (waiter.generation !== this.peerGeneration) {
        this.requestSlotWaiters.shift();
        waiter.cancel(webrtcFailure("transport", "local WebRTC connection generation changed while waiting for a request slot"));
        continue;
      }
      if (this.reservedSlotCount(waiter.generation) >= hostControlRequestLimits.maxOutstandingRequests) return;
      this.requestSlotWaiters.shift();
      waiter.grant(this.reserveSlot(waiter.generation));
      return;
    }
  }

  private cancelRequestSlotWaiters(error: unknown, generation?: number): void {
    const keep: typeof this.requestSlotWaiters = [];
    for (const waiter of this.requestSlotWaiters.splice(0)) {
      if (generation === undefined || waiter.generation === generation) waiter.cancel(error);
      else keep.push(waiter);
    }
    this.requestSlotWaiters.push(...keep);
  }

  /** Host lifecycle events delivered as control-channel `ServerFrame::Event` frames. */
  subscribeHostEvents(onEvent: (event: DaemonEvent) => void): { unsubscribe(): void } {
    this.hostEventListeners.add(onEvent);
    return {
      unsubscribe: () => {
        this.hostEventListeners.delete(onEvent);
      }
    };
  }

  subscribeLifecycle(onEvent: (event: WebrtcDaemonLifecycleEvent) => void): { unsubscribe(): void } {
    this.lifecycleListeners.add(onEvent);
    return {
      unsubscribe: () => {
        this.lifecycleListeners.delete(onEvent);
      }
    };
  }

  addTerminalStreamListener(
    sessionId: string,
    subscriptionId: string,
    onEvent: (event: TerminalStreamEvent) => void | Promise<void>
  ): TerminalStreamListener {
    const listener: TerminalStreamListener = {
      sessionId,
      subscriptionId,
      peerGeneration: this.peerGeneration,
      coreGeneration: undefined,
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
      // Terminal bodies arrive as binary chunks; ArrayBuffer avoids Blob reads per message.
      channel.binaryType = "arraybuffer";
    } catch (error) {
      throw webrtcFailure("transport", `terminal DataChannel creation failed: ${errorMessage(error)}`);
    }
    listener.peerGeneration = reservation.peer_generation;
    listener.coreGeneration = undefined;
    let binding!: TerminalChannelBinding;
    const ready = new Promise<void>((resolve, reject) => {
      binding = {
        listener,
        channel,
        peerGeneration: reservation.peer_generation,
        transportGeneration,
        generation: undefined,
        label: reservation.label,
        closed: false,
        admitted: false,
        outboundMessageId: 0n,
        lastInboundMessageId: 0n,
        resolveReady: resolve,
        rejectReady: reject
      };
    });
    this.terminalChannels.add(binding);
    onCreated(binding);
    if (listener.closed || binding.closed) {
      this.closeTerminalChannel(binding);
      throw webrtcFailure("transport", "terminal reservation owner closed during channel creation");
    }
    let messageQueue = Promise.resolve();
    const admission: InboundAdmission = { frames: 0, bytes: 0 };
    channel.addEventListener("message", (event) => {
      if (binding.closed) return;
      const bytes = inboundFrameBytes(event.data);
      if (!admitInboundFrame(admission, bytes)) {
        recordLiveHarnessEvent("terminal_data_channel_admission_overflow", {
          label: binding.label,
          generation: binding.generation,
          queued_frames: admission.frames,
          queued_bytes: admission.bytes
        });
        binding.rejectReady(inboundAdmissionFailure("terminal", admission));
        this.closeTerminalChannel(binding, true);
        return;
      }
      messageQueue = messageQueue
        .then(() => this.handleTerminalChannelMessage(binding, event.data))
        .catch((error: unknown) => {
          binding.rejectReady(error);
          this.closeTerminalChannel(binding, true);
        })
        .finally(() => releaseInboundFrame(admission, bytes));
    });
    channel.addEventListener("close", () => this.closeTerminalChannel(binding, true));
    channel.addEventListener("error", () => this.closeTerminalChannel(binding, true));
    try {
      // A typed Hub reject can arrive while the channel is still connecting; it settles `ready`.
      await Promise.race([waitForDataChannelOpen(channel), ready]);
      if (listener.closed || binding.closed || transportGeneration !== this.peerGeneration) {
        throw webrtcFailure("transport", "terminal DataChannel opened for a stale reservation");
      }
      const hello: ClientFrame = {
        frame: "hello",
        hello: {
          protocol: hostHelloProtocol,
          compatibility: hostCompatibilityRequirement,
          terminal_compatibility: terminalCompatibilityRequirement
        }
      };
      channel.send(JSON.stringify(await encryptJsonPayload(key, hello)));
      await ready;
      if (listener.closed || binding.closed || transportGeneration !== this.peerGeneration) {
        throw webrtcFailure("transport", "terminal DataChannel admitted for a stale reservation");
      }
      return binding;
    } catch (error) {
      const failure = binding.rejection ?? error;
      binding.rejectReady(failure);
      this.closeTerminalChannel(binding);
      throw failure;
    }
  }

  /**
   * Sends one Core input frame as binary terminal chunks. Each chunk seals one contiguous
   * plaintext slice; no JSON or base64 touches the bytes.
   */
  async sendTerminalFrame(binding: TerminalChannelBinding, frame: Uint8Array): Promise<void> {
    const key = this.cryptoKey;
    if (binding.closed || !binding.admitted || !key || binding.channel.readyState !== "open") {
      throw webrtcFailure("transport", "terminal subscription channel is not ready");
    }
    const totalBytes = frame.byteLength;
    const chunkCount = Math.max(1, Math.ceil(totalBytes / terminalChunkPlaintextBytes));
    const messageId = ++binding.outboundMessageId;
    recordLiveHarnessEvent("terminal_data_channel_send", {
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      message_id: Number(messageId),
      chunk_count: chunkCount,
      total_bytes: totalBytes,
      frame_kind: frame[1] ?? null
    });
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      if (binding.closed || binding.channel.readyState !== "open") {
        throw webrtcFailure("transport", "terminal subscription channel closed during send");
      }
      const slice = frame.subarray(
        chunkIndex * terminalChunkPlaintextBytes,
        Math.min((chunkIndex + 1) * terminalChunkPlaintextBytes, totalBytes)
      );
      // Input carries the fixed attachment identity only; stream_epoch is reserved as 0.
      const message = await sealTerminalChunk(
        key,
        { messageId, chunkIndex, chunkCount, totalBytes, generation: BigInt(admittedTerminalGeneration(binding)), streamEpoch: 0 },
        slice
      );
      if (message.byteLength >= LOCAL_WEBRTC_MAX_FRAME_BYTES) {
        throw webrtcFailure("data-plane", "terminal delivery chunk exceeds the transport limit");
      }
      binding.channel.send(message);
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
        generation: admittedTerminalGeneration(binding)
      });
    }
  }

  /**
   * Terminal DataChannel messages. The reserved channel admits with one JSON delivery chunk
   * carrying the encrypted `ServerFrame::hello_ack`; after admission every message is one
   * binary terminal chunk whose sealed slice decrypts in place into the message body.
   */
  private async handleTerminalChannelMessage(binding: TerminalChannelBinding, data: unknown): Promise<void> {
    const key = this.cryptoKey;
    if (!key) throw webrtcFailure("encryption", "terminal response key is unavailable");
    if (typeof data === "string") {
      if (utf8ByteLength(data) >= localWebrtcResponseChunkLimits.maximumFrameBytesExclusive) {
        throw webrtcFailure("data-plane", "terminal DataChannel control delivery exceeds the transport limit");
      }
      const chunk = parseDeliveryChunk(data);
      if (chunk.chunk_index !== 0 || chunk.chunk_count !== 1) {
        throw webrtcFailure("data-plane", "terminal DataChannel control delivery must be one chunk");
      }
      const frame = parseServerFrame(await decryptDaemonPayload(key, chunk.payload));
      if (frame.frame === "close") {
        throw webrtcFailure("data-plane", `terminal DataChannel closed by Hub: ${describeCloseReason(frame.reason)}`);
      }
      if (binding.admitted || frame.frame !== "hello_ack") {
        throw webrtcFailure("data-plane", "terminal DataChannel received an unexpected control frame");
      }
      const ack = frame.ack;
      if (ack.protocol !== hostHelloProtocol || !isTerminalCompatibilityAccepted(ack.terminal_compatibility)) {
        throw webrtcFailure("data-plane", "terminal DataChannel Hello was rejected");
      }
      // Hub attaches and binds the Core route on this Hello; the ack names its generation.
      const terminalGeneration = ack.terminal_generation;
      if (typeof terminalGeneration !== "number" || !Number.isSafeInteger(terminalGeneration) || terminalGeneration < 0) {
        throw webrtcFailure("data-plane", "terminal DataChannel HelloAck omitted a valid terminal_generation");
      }
      binding.generation = terminalGeneration;
      binding.listener.coreGeneration = terminalGeneration;
      binding.admitted = true;
      binding.resolveReady();
      recordLiveHarnessEvent("terminal_data_channel", {
        state: "ready",
        label: binding.label,
        generation: binding.generation,
        peer_generation: binding.peerGeneration
      });
      return;
    }
    if (!binding.admitted) {
      throw webrtcFailure("data-plane", "terminal DataChannel carried data before admission");
    }
    const message = binaryMessageBytes(data);
    if (!message || message.byteLength >= LOCAL_WEBRTC_MAX_FRAME_BYTES) {
      throw webrtcFailure("data-plane", "terminal DataChannel delivery must be a bounded binary chunk");
    }
    const parsed = parseTerminalChunk(message);
    if (!parsed) {
      throw webrtcFailure("data-plane", "terminal DataChannel chunk header was invalid");
    }
    const { header, sealed } = parsed;
    if (header.generation !== BigInt(admittedTerminalGeneration(binding))) {
      // The HelloAck fixes the route generation for this attachment; any other value is
      // data from a retired subscription and is discarded, never continued.
      recordLiveHarnessEvent("terminal_data_channel_discarded", {
        label: binding.label,
        generation: binding.generation,
        chunk_generation: Number(header.generation)
      });
      return;
    }
    let assembly = binding.assembly;
    if (!assembly) {
      if (header.chunkIndex !== 0) throw webrtcFailure("data-plane", "terminal delivery did not start at chunk zero");
      if (header.messageId <= binding.lastInboundMessageId) {
        throw webrtcFailure("data-plane", "terminal channel message id did not increase");
      }
      if (header.totalBytes > LOCAL_WEBRTC_MAX_DELIVERY_BYTES) {
        throw webrtcFailure("data-plane", "terminal delivery exceeds the delivery limit");
      }
      assembly = binding.assembly = {
        messageId: header.messageId,
        chunkCount: header.chunkCount,
        totalBytes: header.totalBytes,
        generation: header.generation,
        streamEpoch: header.streamEpoch,
        nextIndex: 0,
        body: new Uint8Array(header.totalBytes),
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
      assembly.messageId !== header.messageId ||
      assembly.chunkCount !== header.chunkCount ||
      assembly.totalBytes !== header.totalBytes ||
      assembly.generation !== header.generation ||
      assembly.streamEpoch !== header.streamEpoch ||
      header.chunkIndex !== assembly.nextIndex
    ) {
      throw webrtcFailure("data-plane", "terminal delivery chunk order or metadata was invalid");
    }
    const slice = await openTerminalChunk(key, sealed);
    if (assembly.receivedBytes + slice.byteLength > assembly.totalBytes) {
      throw webrtcFailure("data-plane", "terminal delivery exceeded the declared total bytes");
    }
    assembly.body.set(slice, assembly.receivedBytes);
    assembly.receivedBytes += slice.byteLength;
    assembly.nextIndex += 1;
    recordLiveHarnessEvent("terminal_data_channel_receive", {
      label: binding.label,
      generation: binding.generation,
      peer_generation: binding.peerGeneration,
      message_id: Number(header.messageId),
      chunk_index: header.chunkIndex,
      chunk_count: header.chunkCount,
      total_bytes: header.totalBytes,
      frame_bytes: message.byteLength
    });
    if (assembly.nextIndex !== assembly.chunkCount) return;
    if (assembly.receivedBytes !== assembly.totalBytes) {
      throw webrtcFailure("data-plane", "terminal delivery bytes did not match the declared total");
    }
    window.clearTimeout(assembly.timeout);
    binding.assembly = undefined;
    binding.lastInboundMessageId = assembly.messageId;
    if (binding.listener.closed) return;
    await binding.listener.onEvent({
      route: binding.listener.subscriptionId,
      generation: Number(assembly.generation),
      streamEpoch: assembly.streamEpoch,
      body: assembly.body
    });
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
        rejectReady: reject
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
    const admission: InboundAdmission = { frames: 0, bytes: 0 };
    channel.addEventListener("message", (event) => {
      if (binding.closed) return;
      const bytes = inboundFrameBytes(event.data);
      if (!admitInboundFrame(admission, bytes)) {
        const error = inboundAdmissionFailure("subscription", admission);
        recordLiveHarnessEvent("subscription_data_channel_admission_overflow", {
          class: binding.channelClass,
          label: binding.label,
          generation: binding.generation,
          queued_frames: admission.frames,
          queued_bytes: admission.bytes
        });
        this.emitSubscriptionChannelFailure(binding, "rejected", error);
        binding.rejectReady(error);
        this.closeSubscriptionChannel(binding, true);
        return;
      }
      messageQueue = messageQueue
        .then(() => this.handleSubscriptionChannelMessage(binding, event.data))
        .catch((error: unknown) => {
          this.emitSubscriptionChannelFailure(binding, "rejected", error);
          binding.rejectReady(error);
          this.closeSubscriptionChannel(binding, true);
        })
        .finally(() => releaseInboundFrame(admission, bytes));
    });
    channel.addEventListener("close", () => this.closeSubscriptionChannel(binding, true));
    channel.addEventListener("error", () => this.closeSubscriptionChannel(binding, true));

    try {
      // A typed Hub reject can arrive while the channel is still connecting; it settles `ready`.
      await Promise.race([waitForDataChannelOpen(channel), ready]);
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
      const hello: ClientFrame = {
        frame: "hello",
        hello: {
          protocol: hostHelloProtocol,
          compatibility: hostCompatibilityRequirement
        }
      };
      channel.send(JSON.stringify(await encryptJsonPayload(key, hello)));
      await ready;
      if (!this.isCurrentSubscriptionBinding(binding)) {
        throw webrtcFailure("transport", "subscription DataChannel admitted for a stale reservation");
      }
      return binding;
    } catch (error) {
      const failure = binding.rejection ?? error;
      binding.rejectReady(failure);
      this.closeSubscriptionChannel(binding);
      throw failure;
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
    const frame = parseServerFrame(await decryptDaemonPayload(key, assembly.payloads.join("")));
    if (frame.frame === "close") {
      throw webrtcFailure("data-plane", `subscription DataChannel closed by Hub: ${describeCloseReason(frame.reason)}`);
    }

    if (!binding.admitted) {
      if (frame.frame !== "hello_ack") {
        throw webrtcFailure("data-plane", "subscription DataChannel carried data before admission");
      }
      const ack = frame.ack;
      if (ack.protocol !== hostHelloProtocol || !ack.compatibility) {
        throw webrtcFailure("data-plane", "subscription DataChannel Hello was rejected");
      }
      binding.admitted = true;
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
      if (frame.frame !== "entity") {
        throw webrtcFailure("data-plane", "entity channel received a frame of another class");
      }
      recordLiveHarnessEvent("webrtc_entity_frame_assembly", {
        generation: binding.transportGeneration,
        label: binding.label,
        total_bytes: assembly.totalBytes,
        chunk_count: assembly.chunkCount
      });
      if (!this.maybeDropArmedInboundEntityFrame(frame.entity, binding.transportGeneration)) {
        this.receiveEntityFrame(frame.entity, binding.transportGeneration);
      }
      return;
    }

    if (frame.frame !== "event") {
      throw webrtcFailure("data-plane", "package-event channel received a frame of another class");
    }
    const event = frame.event;
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

  /**
   * Hub refused a reserved channel (reported on the control channel, then the channel is
   * closed). The owning attach or subscribe fails with the typed reason; this, the channel's
   * own close and error events, and control-peer loss are the only ways a reservation fails.
   */
  private rejectReservedChannel(rejection: SubscriptionChannelRejection): void {
    const error = webrtcFailure(
      "data-plane",
      `reserved channel ${rejection.label} rejected by Hub: ${rejection.reason}`
    );
    error.channelRejection = rejection;
    for (const binding of this.terminalChannels) {
      if (binding.label !== rejection.label || binding.admitted) continue;
      binding.rejection = error;
      binding.rejectReady(error);
      this.closeTerminalChannel(binding);
    }
    for (const binding of this.subscriptionChannels) {
      if (binding.label !== rejection.label || binding.admitted) continue;
      binding.rejection = error;
      this.emitSubscriptionChannelFailure(
        binding,
        rejection.reason === "reservation_expired" ? "expired" : "rejected",
        error
      );
      binding.rejectReady(error);
      this.closeSubscriptionChannel(binding);
    }
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
    target: SendTarget,
    plaintext: ClientFrame,
    requestId: string,
    requestType: string,
    kind: PendingKind,
    slot: RequestSlot | undefined,
    sendOptions: { onSent?: () => void; isCancelled?: () => boolean } | undefined,
    parse: (payload: unknown) => T
  ): Promise<T> {
    const { channel, key, generation } = target;
    if (!this.ownsSendTarget(target)) {
      slot?.release();
      throw webrtcFailure("transport", "local WebRTC data channel is not open");
    }
    let envelope: AesGcmEnvelope;
    try {
      envelope = await encryptJsonPayload(key, plaintext);
    } catch (error) {
      slot?.release();
      throw webrtcFailure("encryption", `local WebRTC request encryption failed: ${errorMessage(error)}`);
    }
    if (sendOptions?.isCancelled?.()) {
      // Encryption finished after the caller abandoned the request: nothing is written.
      slot?.release();
      throw webrtcFailure("transport", `local WebRTC request cancelled before send: ${requestType}`);
    }
    if (!this.ownsSendTarget(target)) {
      // The connection changed during encryption. The request stays with its own
      // generation: it fails here, never enters the new generation's pending map, and
      // never overwrites a newer request that reuses its id.
      slot?.release();
      throw webrtcFailure("transport", `local WebRTC connection changed while ${requestType} was encrypting`);
    }
    const key2 = pendingKey(generation, requestId);
    if (this.pendingRequests.has(key2)) {
      slot?.release();
      throw webrtcFailure("data-plane", `local WebRTC request id ${requestId} is already pending on generation ${generation}`);
    }
    return new Promise<T>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        const error = new WebrtcDaemonClientError(
          "data-plane",
          `local WebRTC request timed out: ${requestType}`,
          kind === "hello" ? undefined : {
            code: "local_request_timeout",
            request_id: requestId,
            operation: requestType
          }
        );
        if (kind === "hello") {
          this.failPeerGeneration(generation, error);
          return;
        }
        if (requestType === "attach") {
          recordLiveHarnessEvent("terminal_attach_timeout", { generation, request_id: requestId });
        }
        this.settlePending(key2, pending, (entry) => entry.reject(error));
      }, requestTimeoutMs);

      const pending: PendingRequest = {
        generation,
        requestId,
        requestType,
        slot,
        kind,
        resolve: (response) => {
          window.clearTimeout(timeout);
          resolve(parse(response));
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      };
      this.pendingRequests.set(key2, pending);

      try {
        channel.send(JSON.stringify(envelope));
        sendOptions?.onSent?.();
        if (!this.encryptedStreamReady && kind !== "hello") {
          this.encryptedStreamReady = true;
          this.emitLifecycle({ type: "encrypted-stream-ready", requestType });
        }
      } catch (error) {
        this.settlePending(key2, pending, (entry) =>
          entry.reject(
            new WebrtcDaemonClientError(
              "data-plane",
              `local WebRTC data-plane send failed for ${requestType}: ${errorMessage(error)}`,
              kind === "hello" ? undefined : {
                code: "local_request_interrupted",
                request_id: requestId,
                operation: requestType
              }
            )
          )
        );
      }
    });
  }

  /** Removes one pending entry by identity, settles it, and frees a request slot. */
  private settlePending(
    key: string,
    pending: PendingRequest,
    settle: (entry: PendingRequest) => void
  ): void {
    if (this.pendingRequests.get(key) !== pending) return;
    this.pendingRequests.delete(key);
    settle(pending);
    pending.slot?.release();
  }

  private async sendHello(attempt: ConnectAttempt): Promise<DaemonHelloAck> {
    const generation = attempt.generation;
    if (!this.ownsAttempt(attempt)) {
      throw webrtcFailure("transport", "local WebRTC hello targeted a stale peer generation");
    }
    if (this.helloPromise && this.helloGeneration === generation) return this.helloPromise;
    this.helloGeneration = generation;
    const hello: ClientFrame = {
      frame: "hello",
      hello: {
        protocol: hostHelloProtocol,
        compatibility: hostCompatibilityRequirement,
        terminal_compatibility: terminalCompatibilityRequirement
      }
    };
    recordLiveHarnessEvent("daemon_hello", hello.hello);
    const helloChannel = this.dataChannel;
    const helloKey = this.cryptoKey;
    if (!helloChannel || !helloKey) {
      throw webrtcFailure("transport", "local WebRTC data channel is not open");
    }
    this.helloPromise = this.sendEncrypted<DaemonHelloAck>({ generation, channel: helloChannel, key: helloKey }, hello, "", "hello", "hello", undefined, undefined, (payload) => {
      const ack = payload as DaemonHelloAck;
      if (!ack || typeof ack.protocol !== "string" || !ack.compatibility) {
        throw webrtcFailure("data-plane", "local WebRTC hello ack is not a DaemonHelloAck");
      }
      return ack;
    }).then((ack) => {
      // Post-await guard: a Hello ack for a superseded or disconnected attempt must not
      // mark the stream ready or emit lifecycle events.
      if (!this.ownsAttempt(attempt)) {
        throw webrtcFailure("transport", "local WebRTC hello ack arrived for a superseded attempt");
      }
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
      // Lifecycle callbacks run synchronously and may disconnect or reconnect. Re-check
      // ownership after the callback boundary before marking the stream ready.
      if (!this.ownsAttempt(attempt)) {
        throw webrtcFailure("transport", "local WebRTC attempt was cancelled during the hello-ack callback");
      }
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

    if (this.connectPromise) return this.connectPromise;
    // A caller during the retry wait starts the attempt now through the same single path.
    this.cancelRetryTimer();
    return this.startAttempt();
  }

  private startAttempt(): Promise<void> {
    // The previous peer, if any, is already reset by the loss path. Close anything left over
    // before the new attempt publishes its own resources.
    this.resetPeerState();
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((resolveAttempt, rejectAttempt) => {
      resolve = resolveAttempt;
      reject = rejectAttempt;
    });
    // Callers that never await this promise (retry timer, loss path) must not surface an
    // unhandled rejection; the attempt reports failure through failAttempt.
    promise.catch(() => undefined);
    // Request ids restart at 1 on every connection generation: they are strictly
    // increasing for the connection lifetime and the server keeps only the last id.
    this.nextRequestId = 1;
    const attempt: ConnectAttempt = {
      generation: ++this.peerGeneration,
      promise,
      resolve,
      reject,
      settled: false,
      deadlineTimer: undefined,
      abort: typeof AbortController === "function" ? new AbortController() : undefined,
      peerConnection: undefined,
      dataChannel: undefined
    };
    this.currentAttempt = attempt;
    this.connectPromise = promise;
    this.peerFailed = false;
    // Install every owned resource before the lifecycle callback boundary, so a callback
    // that disconnects clears the deadline through the attempt and this method stops.
    attempt.deadlineTimer = window.setTimeout(() => {
      attempt.deadlineTimer = undefined;
      this.failAttempt(
        attempt,
        webrtcFailure("transport", `local WebRTC connection attempt timed out after ${localWebrtcReconnectPolicy.attemptTimeoutMs} ms`)
      );
    }, localWebrtcReconnectPolicy.attemptTimeoutMs);
    if (this.reconnectDemand) {
      this.emitLifecycle({
        type: "reconnect-attempt",
        attempt: this.retryAttempt + 1,
        deadlineMs: localWebrtcReconnectPolicy.attemptTimeoutMs
      });
      if (attempt.settled || !this.ownsAttempt(attempt)) {
        return promise;
      }
    }
    void this.open(attempt).then(
      () => this.completeAttempt(attempt),
      (error: unknown) => this.failAttempt(attempt, error)
    );
    return promise;
  }

  private ownsAttempt(attempt: ConnectAttempt): boolean {
    return this.currentAttempt === attempt && attempt.generation === this.peerGeneration && !this.disconnected;
  }

  private staleAttemptFailure(): WebrtcDaemonClientError {
    return webrtcFailure("transport", "local WebRTC connection attempt was superseded");
  }

  private completeAttempt(attempt: ConnectAttempt): void {
    if (attempt.settled) return;
    attempt.settled = true;
    this.clearAttemptDeadline(attempt);
    if (this.connectPromise === attempt.promise) this.connectPromise = undefined;
    if (this.ownsAttempt(attempt)) {
      // Retry state resets only after the authenticated Hello that open() awaited.
      this.retryAttempt = 0;
      this.reconnectDemand = false;
      this.cancelRetryTimer();
    }
    attempt.resolve();
  }

  /**
   * Fails one attempt by identity. An owning attempt captures the failure and the reconnect
   * demand before invalidation, resets shared peer state, and schedules recovery. A stale
   * attempt closes only its own resources and never touches a newer attempt.
   */
  private failAttempt(attempt: ConnectAttempt, error: unknown, demandOverride?: boolean): void {
    if (attempt.settled) return;
    attempt.settled = true;
    this.clearAttemptDeadline(attempt);
    attempt.abort?.abort();
    const owner = this.ownsAttempt(attempt);
    if (owner) {
      const demand = demandOverride ?? (this.reconnectDemand || this.hasReconnectDemand());
      this.currentAttempt = undefined;
      if (this.connectPromise === attempt.promise) this.connectPromise = undefined;
      this.resetPeerState();
      this.closeAttemptResources(attempt);
      this.failPending(error);
      attempt.reject(error);
      if (demand && !this.disconnected) {
        this.reconnectDemand = true;
        this.scheduleRetry(error);
      }
      return;
    }
    this.closeAttemptResources(attempt);
    attempt.reject(error);
  }

  private clearAttemptDeadline(attempt: ConnectAttempt): void {
    if (attempt.deadlineTimer === undefined) return;
    window.clearTimeout(attempt.deadlineTimer);
    attempt.deadlineTimer = undefined;
  }

  private closeAttemptResources(attempt: ConnectAttempt): void {
    const dataChannel = attempt.dataChannel;
    const peerConnection = attempt.peerConnection;
    attempt.dataChannel = undefined;
    attempt.peerConnection = undefined;
    if (dataChannel === this.dataChannel) this.dataChannel = undefined;
    if (peerConnection === this.peerConnection) this.peerConnection = undefined;
    try {
      if (dataChannel && dataChannel.readyState !== "closed") dataChannel.close?.();
    } catch {
      // Closing a failed channel is best-effort.
    }
    try {
      peerConnection?.close?.();
    } catch {
      // Closing a failed peer is best-effort.
    }
  }

  private scheduleRetry(error: unknown): void {
    if (this.retryTimer !== undefined || this.disconnected) return;
    this.retryAttempt += 1;
    const delayMs = Math.min(
      localWebrtcReconnectPolicy.initialDelayMs * 2 ** (this.retryAttempt - 1),
      localWebrtcReconnectPolicy.maxDelayMs
    );
    recordLiveHarnessEvent("webrtc_reconnect_scheduled", {
      attempt: this.retryAttempt,
      delay_ms: delayMs,
      message: errorMessage(error)
    });
    // Install the timer before the lifecycle callback boundary. A callback that disconnects
    // or starts a connection cancels this timer through cancelRetryTimer.
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined;
      if (this.disconnected || !this.reconnectDemand) return;
      void this.connect().catch(() => undefined);
    }, delayMs);
    this.emitLifecycle({
      type: "reconnect-scheduled",
      attempt: this.retryAttempt,
      delayMs,
      detail: errorMessage(error)
    });
  }

  private cancelRetryTimer(): void {
    if (this.retryTimer === undefined) return;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }

  disconnect(): void {
    this.disconnected = true;
    if (typeof window !== "undefined" && this.pageHideHandler && typeof window.removeEventListener === "function") {
      window.removeEventListener("pagehide", this.pageHideHandler);
    }
    // Invalidate ownership before cleanup so a late attempt cannot publish.
    const attempt = this.currentAttempt;
    this.currentAttempt = undefined;
    this.cancelRetryTimer();
    this.reconnectDemand = false;
    const error = webrtcFailure("transport", "local WebRTC transport disconnected");
    if (attempt && !attempt.settled) {
      attempt.settled = true;
      this.clearAttemptDeadline(attempt);
      attempt.abort?.abort();
      this.closeAttemptResources(attempt);
      attempt.reject(error);
    }
    this.connectPromise = undefined;
    this.resetPeerState();
    this.failPending(error);
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

  /**
   * Runs one attempt. The attempt identity is allocated by startAttempt before this method's
   * first await. Every await is followed by an ownership check; a superseded attempt closes
   * only its own resources and rejects without touching shared state.
   */
  private async open(attempt: ConnectAttempt): Promise<void> {
    const generation = attempt.generation;
    const bootstrap = await this.resolveBootstrap();
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
    let cryptoKey: CryptoKey;
    try {
      cryptoKey = await importStreamKey(bootstrap.grant_secret);
    } catch (error) {
      throw webrtcFailure("bootstrap", `local WebRTC bootstrap grant is invalid: ${errorMessage(error)}`);
    }
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();

    let peerConnection: RTCPeerConnection;
    try {
      peerConnection = this.peerConnectionFactory();
    } catch (error) {
      throw webrtcFailure("transport", `local WebRTC peer connection failed: ${errorMessage(error)}`);
    }
    attempt.peerConnection = peerConnection;
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
    attempt.dataChannel = dataChannel;
    // Publish only while owning. Peer listeners below check identity against these fields.
    this.cryptoKey = cryptoKey;
    this.peerConnection = peerConnection;
    this.dataChannel = dataChannel;
    let messageQueue = Promise.resolve();
    const admission: InboundAdmission = { frames: 0, bytes: 0 };
    dataChannel.addEventListener("message", (event) => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      const bytes = inboundFrameBytes(event.data);
      if (!admitInboundFrame(admission, bytes)) {
        recordLiveHarnessEvent("webrtc_data_channel_admission_overflow", {
          generation,
          queued_frames: admission.frames,
          queued_bytes: admission.bytes
        });
        this.failPeerGeneration(generation, inboundAdmissionFailure("control", admission));
        return;
      }
      messageQueue = messageQueue
        .then(() => this.handleMessage(event.data, generation))
        .catch((error: unknown) => this.failPeerGeneration(generation, error))
        .finally(() => releaseInboundFrame(admission, bytes));
    });
    dataChannel.addEventListener("open", () => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      recordLiveHarnessEvent("webrtc_data_channel", { state: "open" });
      this.emitLifecycle({ type: "data-channel-open" });
    });
    dataChannel.addEventListener("close", () => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      recordLiveHarnessEvent("webrtc_data_channel", { state: "closed" });
      const shouldReconnect = this.captureReconnectDemand();
      this.emitLifecycle({ type: "data-channel-closed" });
      this.handleTransportClosed(
        webrtcFailure("transport", "local WebRTC data channel closed"),
        shouldReconnect,
        generation
      );
    });
    dataChannel.addEventListener("error", () => {
      if (!this.isCurrentPeer(generation, peerConnection, dataChannel)) return;
      recordLiveHarnessEvent("webrtc_data_channel", { state: "error" });
      const shouldReconnect = this.captureReconnectDemand();
      this.emitLifecycle({ type: "data-channel-error" });
      this.handleTransportClosed(
        webrtcFailure("transport", "local WebRTC data channel failed"),
        shouldReconnect,
        generation
      );
    });

    let offer: RTCSessionDescriptionInit;
    try {
      offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
    } catch (error) {
      throw webrtcFailure("transport", `local WebRTC offer creation failed: ${errorMessage(error)}`);
    }
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
    await waitForIceGatheringComplete(peerConnection);
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();

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
        }),
        ...(attempt.abort ? { signal: attempt.abort.signal } : {})
      });
    } catch (error) {
      if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
      throw webrtcFailure("signaling", `local WebRTC signaling request failed: ${errorMessage(error)}`);
    }
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
    if (!response.ok) {
      throw webrtcFailure("signaling", `local WebRTC signaling failed with HTTP ${response.status}`);
    }
    const reply = await response.json() as { payload?: DaemonResponse };
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
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
      await waitForDataChannelOpen(dataChannel, requestTimeoutMs);
    } catch (error) {
      if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
      throw webrtcFailure("transport", `local WebRTC transport failed: ${errorMessage(error)}`);
    }
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
    await this.sendHello(attempt);
    if (!this.ownsAttempt(attempt)) throw this.staleAttemptFailure();
    queueMicrotask(() => {
      // Cancellation fence: a disconnect or supersession between Hello and this microtask
      // must not restore subscriptions on a peer that no longer owns the client.
      if (!this.ownsAttempt(attempt)) return;
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
      if (this.responseAssemblies.size >= localWebrtcResponseChunkLimits.maximumConcurrentAssemblies) {
        throw webrtcFailure("data-plane", "local WebRTC response assembly limit exceeded");
      }

      const retainedBytes =
        localWebrtcResponseChunkLimits.assemblyBookkeepingBytes +
        localWebrtcResponseChunkLimits.chunkBookkeepingBytes +
        utf8ByteLength(chunk.payload);
      this.ensureAggregateBudget(retainedBytes);
      const startedAt = Date.now();
      assembly = {
        generation,
        deliveryKind: chunk.delivery_kind,
        chunkCount: chunk.chunk_count,
        totalBytes: chunk.total_bytes,
        chunks: new Map([[chunk.chunk_index, chunk.payload]]),
        receivedBytes: utf8ByteLength(chunk.payload),
        retainedBytes,
        startedAt,
        timeout: window.setTimeout(() => {
          if (!applyAssemblyTimeoutCleanup) return;
          // An ordered channel that stops mid-message is a transport fault for the whole
          // connection; the reassembly header carries no request identity before decrypt.
          this.failPeerGeneration(
            generation,
            webrtcFailure("data-plane", `local WebRTC ${chunk.delivery_kind} assembly timed out`)
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

    const frame = parseServerFrame(payload);
    if (frame.frame === "hello_ack") {
      const helloKey = pendingKey(generation, "");
      const pendingHello = this.pendingRequests.get(helloKey);
      if (!pendingHello) {
        throw webrtcFailure("data-plane", "control DataChannel received a Hello ack without a pending Hello");
      }
      this.settlePending(helloKey, pendingHello, (entry) => entry.resolve(frame.ack));
      return;
    }
    if (frame.frame === "close") {
      // Hub names the reason before it closes; the connection takes the ordinary loss path.
      throw webrtcFailure("data-plane", `control DataChannel closed by Hub: ${describeCloseReason(frame.reason)}`);
    }
    if (frame.frame === "event") {
      recordLiveHarnessEvent("webrtc_daemon_event_assembly", {
        generation,
        total_bytes: assembly.totalBytes,
        chunk_count: assembly.chunkCount,
        started_at: assembly.startedAt,
        finished_at: finishedAt,
        duration_ms: finishedAt - assembly.startedAt
      });
      await this.receiveHostEvent(frame.event, generation);
      return;
    }
    if (frame.frame === "entity") {
      throw webrtcFailure("data-plane", "control DataChannel received an entity delivery");
    }
    const key2 = pendingKey(generation, frame.request_id);
    const pending = this.pendingRequests.get(key2);
    if (!pending) {
      // Unknown or already-settled id on this generation: discard this completion only.
      recordLiveHarnessEvent("stale_control_response", {
        request_id: frame.request_id,
        response_kind: frame.response.kind,
        generation
      });
      return;
    }
    recordLiveHarnessEvent("webrtc_response_assembly", {
      request_type: pending.requestType,
      request_id: frame.request_id,
      generation,
      total_bytes: assembly.totalBytes,
      chunk_count: assembly.chunkCount,
      started_at: assembly.startedAt,
      finished_at: finishedAt,
      duration_ms: finishedAt - assembly.startedAt
    });
    this.settlePending(key2, pending, (entry) => entry.resolve(frame.response));
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
    const shouldReconnect = this.captureReconnectDemand();
    this.emitLifecycle({ type: "data-channel-error" });
    this.handleTransportClosed(error, shouldReconnect, generation);
  }

  /**
   * Captures reconnect demand at the moment of loss, before lifecycle callbacks run. A
   * callback may detach terminal listeners and may start the next attempt; the demand
   * stays sticky for that attempt. Only an authenticated Hello or disconnect clears it.
   */
  private captureReconnectDemand(): boolean {
    const demand = this.reconnectDemand || this.hasReconnectDemand();
    if (demand && !this.disconnected) this.reconnectDemand = true;
    return demand;
  }

  /** Rejects pending requests; with a generation, only that peer generation's requests. */
  private failPending(error: unknown, generation?: number): void {
    const failing: PendingRequest[] = [];
    for (const [key, pending] of this.pendingRequests) {
      if (generation === undefined || pending.generation === generation) {
        this.pendingRequests.delete(key);
        failing.push(pending);
      }
    }
    for (const pending of failing) {
      const requestError = error instanceof WebrtcDaemonClientError && pending.kind !== "hello"
        ? new WebrtcDaemonClientError(error.botsterWebrtcStage, error.message, {
            code: "local_request_interrupted",
            request_id: pending.requestId,
            operation: pending.requestType
          })
        : error;
      pending.reject(requestError);
      pending.slot?.release();
    }
    this.cancelRequestSlotWaiters(error, generation);
  }

  private hasReconnectDemand(): boolean {
    return (
      this.entitySubscriptions.size > 0 ||
      this.packageEventHolders.size > 0 ||
      this.terminalStreamListeners.size > 0
    );
  }

  private handleTransportClosed(
    error: unknown,
    shouldReconnect = this.hasReconnectDemand(),
    generation = this.peerGeneration
  ): void {
    if (generation !== this.peerGeneration) {
      // A lifecycle callback already started a newer attempt, which reset the lost peer.
      // Fail only the lost generation's requests; never touch the newer attempt.
      this.failPending(error, generation);
      return;
    }
    const attempt = this.currentAttempt;
    if (attempt && !attempt.settled) {
      // The peer closed while its attempt was still connecting: fail that attempt by
      // identity so the deadline, abort controller, and retry path all resolve once.
      this.failAttempt(attempt, error, shouldReconnect || this.reconnectDemand);
      return;
    }
    this.resetPeerState();
    this.failPending(error);
    if (!this.disconnected && (shouldReconnect || this.reconnectDemand)) {
      // Demand is captured before terminal listeners detach and stays sticky until an
      // authenticated Hello, so later retries do not re-evaluate it.
      this.reconnectDemand = true;
      queueMicrotask(() => void this.recoverConnection());
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
    // connectPromise is cleared by attempt identity in completeAttempt, failAttempt, and
    // disconnect, never here: a stale reset must not clear a newer attempt.
    this.cryptoKey = undefined;
    this.encryptedStreamReady = false;
    this.helloPromise = undefined;
    this.helloGeneration = undefined;
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
    // Direct subscribers first: they are scoped to this transport. The window event that
    // follows is the document-wide diagnostic feed and carries no transport identity.
    for (const listener of [...this.lifecycleListeners]) listener(event);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(webRtcDaemonLifecycleEventName, { detail: event }));
    }
  }

  /**
   * First recovery attempt after a loss. A failed attempt schedules the next one through
   * failAttempt, so recovery does not depend on a new caller request.
   */
  private async recoverConnection(): Promise<void> {
    if (this.disconnected || !this.reconnectDemand) return;
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
    if (event.type === "runtime_observation") {
      const rejection = parseSubscriptionChannelRejection(event.kind);
      if (rejection) this.rejectReservedChannel(rejection);
    }
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
    for (const listener of this.hostEventListeners) {
      listener(event);
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

/** The Core generation of an admitted terminal channel; admission always sets it first. */
function admittedTerminalGeneration(binding: TerminalChannelBinding): number {
  if (!binding.admitted || binding.generation === undefined) {
    throw webrtcFailure("data-plane", "terminal channel used before its HelloAck named a generation");
  }
  return binding.generation;
}

export type SubscriptionChannelRejection = {
  reason: string;
  label: string;
  /** Only an expired reservation is worth retrying with a fresh attach or subscribe. */
  retryable: boolean;
};

const subscriptionChannelRejectedPrefix = "subscription_channel_rejected:";

/** Parses Hub's `subscription_channel_rejected:<reason>:<label>` runtime observation. */
export function parseSubscriptionChannelRejection(kind: string): SubscriptionChannelRejection | undefined {
  if (!kind.startsWith(subscriptionChannelRejectedPrefix)) return undefined;
  const rest = kind.slice(subscriptionChannelRejectedPrefix.length);
  const separator = rest.indexOf(":");
  if (separator <= 0 || separator === rest.length - 1) return undefined;
  const reason = rest.slice(0, separator);
  return { reason, label: rest.slice(separator + 1), retryable: reason === "reservation_expired" };
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
  if (chunk.delivery_kind !== "server_frame") {
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
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: cryptoInput(nonce) }, key, plaintext);
  return {
    nonce: base64Encode(nonce),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
    version: 1
  };
}

type TerminalChunkHeader = {
  messageId: bigint;
  chunkIndex: number;
  chunkCount: number;
  totalBytes: number;
  generation: bigint;
  streamEpoch: number;
};

function binaryMessageBytes(data: unknown): Uint8Array | undefined {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return undefined;
}

/** Split one binary terminal chunk into its header and sealed slice; `undefined` when malformed. */
function parseTerminalChunk(message: Uint8Array): { header: TerminalChunkHeader; sealed: Uint8Array } | undefined {
  const sealedMinimum = terminalChunkNonceBytes + terminalChunkTagBytes;
  if (message.byteLength < terminalChunkHeaderBytes + sealedMinimum) return undefined;
  if (message[0] !== LOCAL_WEBRTC_DELIVERY_CHUNK_VERSION) return undefined;
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  const header: TerminalChunkHeader = {
    messageId: view.getBigUint64(1, true),
    chunkIndex: view.getUint32(9, true),
    chunkCount: view.getUint32(13, true),
    totalBytes: view.getUint32(17, true),
    generation: view.getBigUint64(21, true),
    streamEpoch: view.getUint32(29, true)
  };
  if (
    header.chunkCount === 0 ||
    header.chunkIndex >= header.chunkCount ||
    header.totalBytes > LOCAL_WEBRTC_MAX_DELIVERY_BYTES ||
    header.chunkCount > Math.max(1, header.totalBytes)
  ) {
    return undefined;
  }
  return { header, sealed: message.subarray(terminalChunkHeaderBytes) };
}

async function sealTerminalChunk(
  key: CryptoKey,
  header: TerminalChunkHeader,
  plaintext: Uint8Array
): Promise<ArrayBuffer> {
  const nonce = crypto.getRandomValues(new Uint8Array(terminalChunkNonceBytes));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: cryptoInput(nonce) }, key, cryptoInput(plaintext))
  );
  const message = new Uint8Array(terminalChunkHeaderBytes + nonce.byteLength + ciphertext.byteLength);
  const view = new DataView(message.buffer);
  message[0] = LOCAL_WEBRTC_DELIVERY_CHUNK_VERSION;
  view.setBigUint64(1, header.messageId, true);
  view.setUint32(9, header.chunkIndex, true);
  view.setUint32(13, header.chunkCount, true);
  view.setUint32(17, header.totalBytes, true);
  view.setBigUint64(21, header.generation, true);
  view.setUint32(29, header.streamEpoch, true);
  message.set(nonce, terminalChunkHeaderBytes);
  message.set(ciphertext, terminalChunkHeaderBytes + nonce.byteLength);
  return message.buffer;
}

async function openTerminalChunk(key: CryptoKey, sealed: Uint8Array): Promise<Uint8Array> {
  const nonce = sealed.subarray(0, terminalChunkNonceBytes);
  const ciphertext = sealed.subarray(terminalChunkNonceBytes);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: cryptoInput(nonce) }, key, cryptoInput(ciphertext))
    );
  } catch (error) {
    throw webrtcFailure("encryption", `terminal chunk decryption failed: ${errorMessage(error)}`);
  }
}

function describeCloseReason(reason: DaemonCloseReason): string {
  return reason.reason === "protocol_error" ? `protocol error ${reason.code}` : reason.reason;
}

/**
 * Decodes one host-control v10 `ServerFrame`. A payload without a known `frame` tag, or a
 * response without a decimal `request_id`, is a protocol error: the caller closes the
 * connection, because a frame the client cannot correlate cannot be answered or ignored safely.
 */
function parseServerFrame(value: unknown): ServerFrame {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw webrtcFailure("data-plane", "host control frame must be a JSON object");
  }
  const frame = value as Record<string, unknown>;
  const isObject = (candidate: unknown) => Boolean(candidate && typeof candidate === "object");
  switch (frame.frame) {
    case "hello_ack":
      if (isObject(frame.ack)) return value as ServerFrame;
      break;
    case "response":
      if (
        typeof frame.request_id === "string" &&
        /^[1-9][0-9]{0,19}$/.test(frame.request_id) &&
        isObject(frame.response)
      ) {
        return value as ServerFrame;
      }
      break;
    case "event":
      if (isObject(frame.event)) return value as ServerFrame;
      break;
    case "entity":
      if (isObject(frame.entity)) return value as ServerFrame;
      break;
    case "close":
      if (isObject(frame.reason)) return value as ServerFrame;
      break;
    default:
      break;
  }
  throw webrtcFailure("data-plane", `host control frame is malformed: ${String(frame.frame)}`);
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
    { name: "AES-GCM", iv: cryptoInput(base64Decode(envelope.nonce)) },
    key,
    cryptoInput(base64Decode(envelope.ciphertext))
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function importStreamKey(secret: string): Promise<CryptoKey> {
  const encoded = secret.startsWith("secret-") ? secret.slice("secret-".length) : "";
  const keyBytes = hexDecode(encoded);
  if (keyBytes.length !== 32) {
    throw new Error("invalid local WebRTC bootstrap secret");
  }
  return crypto.subtle.importKey("raw", cryptoInput(keyBytes), "AES-GCM", false, ["encrypt", "decrypt"]);
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

/**
 * WebCrypto takes any ArrayBuffer-backed view, bounded by its own offset and length, so a
 * subarray of a received message decrypts in place. Only a view over a SharedArrayBuffer,
 * which WebCrypto rejects, is copied into a fresh ArrayBuffer.
 */
function cryptoInput(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) return bytes as Uint8Array<ArrayBuffer>;
  return new Uint8Array(bytes);
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

/**
 * Resolves on the channel's own "open" and rejects on its "error" or "close". Only the control
 * channel passes a deadline; reserved channels fail on WebRTC events or Hub's typed reject.
 */
function waitForDataChannelOpen(dataChannel: RTCDataChannel, deadlineMs?: number): Promise<void> {
  if (dataChannel.readyState === "open") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = deadlineMs === undefined
      ? undefined
      // timer: deadline — the control DataChannel handshake; expiry fails this connect attempt.
      : window.setTimeout(() => {
          cleanup();
          reject(new Error("timed out waiting for local WebRTC data channel"));
        }, deadlineMs);
    const cleanup = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
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
