import type {
  AesGcmEnvelope,
  DaemonEvent,
  DaemonLocalWebrtcBootstrap,
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
  peerConnectionFactory?: () => RTCPeerConnection;
}

type PendingRequest = {
  resolve(response: DaemonResponse): void;
  reject(error: unknown): void;
};

const requestTimeoutMs = 10_000;
const drainIntervalMs = 25;

export function createWebrtcDaemonClient(options: WebrtcDaemonClientOptions): DaemonBridgeClient {
  const transport = new WebrtcDaemonTransport(options);
  const eventListeners = new Set<(event: DaemonEvent) => void>();

  return {
    async request(request) {
      return transport.request(request);
    },
    subscribeEvents(onEvent) {
      eventListeners.add(onEvent);
      return {
        unsubscribe: () => {
          eventListeners.delete(onEvent);
        }
      };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      let closed = false;
      let timer: number | undefined;

      const emitEvents = (response: DaemonResponse) => {
        for (const event of response.events ?? []) {
          recordLiveHarnessEvent("daemon_event", event);
          eventListeners.forEach((listener) => listener(event));
          onEvent(event);
        }
      };

      const drain = async () => {
        if (closed) return;

        try {
          emitEvents(await transport.request({ type: "drain", session_id: sessionId }));
        } catch {
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
          emitEvents(response);
          void drain();
        })
        .catch(() => {
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
  private readonly pendingRequests: PendingRequest[] = [];
  private peerConnection: RTCPeerConnection | undefined;
  private dataChannel: RTCDataChannel | undefined;
  private cryptoKey: CryptoKey | undefined;
  private connectPromise: Promise<void> | undefined;

  constructor(private readonly options: WebrtcDaemonClientOptions) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.peerConnectionFactory = options.peerConnectionFactory ?? (() => new RTCPeerConnection());
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
      throw new Error("local WebRTC data channel is not open");
    }

    recordLiveHarnessEvent("daemon_request", request);
    const envelope = await encryptDaemonRequest(key, request);
    channel.send(JSON.stringify(envelope));

    return new Promise<DaemonResponse>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        const index = this.pendingRequests.findIndex((entry) => entry.resolve === resolve);
        if (index >= 0) {
          this.pendingRequests.splice(index, 1);
        }
        reject(new Error(`local WebRTC request timed out: ${request.type}`));
      }, requestTimeoutMs);

      this.pendingRequests.push({
        resolve: (response) => {
          window.clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  private connect(): Promise<void> {
    this.connectPromise ??= this.open();
    return this.connectPromise;
  }

  private async open(): Promise<void> {
    const bootstrap = this.options.bootstrap;
    this.cryptoKey = await importStreamKey(bootstrap.grant_secret);
    const peerConnection = this.peerConnectionFactory();
    this.peerConnection = peerConnection;
    const dataChannel = peerConnection.createDataChannel("botster-daemon", {
      ordered: bootstrap.ordered,
      maxRetransmits: bootstrap.max_retransmits ?? undefined,
      maxPacketLifeTime: bootstrap.max_packet_lifetime_ms ?? undefined
    });
    this.dataChannel = dataChannel;
    dataChannel.addEventListener("message", (event) => {
      void this.handleMessage(event.data).catch((error: unknown) => this.failPending(error));
    });
    dataChannel.addEventListener("open", () => recordLiveHarnessEvent("webrtc_data_channel", { state: "open" }));
    dataChannel.addEventListener("close", () => {
      recordLiveHarnessEvent("webrtc_data_channel", { state: "closed" });
      this.failPending(new Error("local WebRTC data channel closed"));
    });
    dataChannel.addEventListener("error", () => {
      recordLiveHarnessEvent("webrtc_data_channel", { state: "error" });
      this.failPending(new Error("local WebRTC data channel failed"));
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(peerConnection);

    const signalRequest: DaemonRequest = {
      type: "local_webrtc_signal",
      grant_id: bootstrap.grant_id,
      grant_secret: bootstrap.grant_secret,
      origin: window.location.origin,
      offer: (peerConnection.localDescription?.toJSON?.() ?? peerConnection.localDescription) as unknown as JsonValue
    };
    recordLiveHarnessEvent("daemon_request", signalRequest);

    const response = await this.fetchImpl(bootstrap.signaling_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "daemon_request",
        request_id: `local-webrtc-signal-${Date.now()}`,
        payload: signalRequest
      })
    });
    if (!response.ok) {
      throw new Error(`local WebRTC signaling failed with HTTP ${response.status}`);
    }
    const reply = await response.json() as { payload?: DaemonResponse };
    const answer = reply.payload?.local_webrtc_answer?.answer;
    recordLiveHarnessEvent("webrtc_signal_response", {
      has_answer: Boolean(answer),
      diagnostics: reply.payload?.local_webrtc_answer?.diagnostics ?? reply.payload?.diagnostics ?? [],
      error: reply.payload?.error ?? null
    });
    if (!answer) {
      throw new Error("local WebRTC signaling response did not include an answer");
    }
    await peerConnection.setRemoteDescription(answer as unknown as RTCSessionDescriptionInit);
    await waitForDataChannelOpen(dataChannel);
  }

  private async handleMessage(data: unknown): Promise<void> {
    const key = this.cryptoKey;
    const pending = this.pendingRequests.shift();
    if (!key || !pending) return;

    try {
      const response = await decryptDaemonResponse(key, String(data));
      pending.resolve(response);
    } catch (error) {
      pending.reject(error);
    }
  }

  private failPending(error: unknown): void {
    for (const pending of this.pendingRequests.splice(0)) {
      pending.reject(error);
    }
  }
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

async function decryptDaemonResponse(key: CryptoKey, envelopeJson: string): Promise<DaemonResponse> {
  const envelope = JSON.parse(envelopeJson) as AesGcmEnvelope;
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64Decode(envelope.nonce)) },
    key,
    toArrayBuffer(base64Decode(envelope.ciphertext))
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as DaemonResponse;
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
  harness?.events?.push({ kind, payload });
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
