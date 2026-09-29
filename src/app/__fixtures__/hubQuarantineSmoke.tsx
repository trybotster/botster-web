/**
 * Browser fixture for scripts/hub-quarantine-smoke.mjs: the production Hub transport, Web
 * client, useHubActions, and HubGeneralSection over a scripted Hub bridge. Each
 * resolve_quarantine answer waits until the smoke driver releases it, so the driver sees the
 * pending row before the answer. Dev-server page only; not in dist.
 */

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "@ionic/react/css/core.css";
import "@ionic/react/css/structure.css";
import "../../theme/variables.css";
import "../../theme/app.css";

import { createBotsterWebClient } from "../../botster/client";
import type { DaemonQuarantine } from "../../botster/generated/daemon-protocol";
import { quarantineKey, quarantineTargetKey, resolveQuarantineAction } from "../../botster/hubQuarantines";
import { createHubTransport, type DaemonBridgeClient } from "../../botster/hubTransport";
import type { DaemonRequest, DaemonResponse } from "../../botster/realHubDaemonDto";
import { notifyWaits, observeLog } from "../../botster/smokeWaitSignals";
import { HubGeneralSection } from "../hubSettings";
import { useHubActions } from "../useHubActions";

type ReleaseMode = "resolved" | "refused" | "throw";

let quarantines: DaemonQuarantine[] = [
  { kind: "package", package_name: "acme.refused", original: "enable failed", compensation: "disable failed", durable: true, loaded: false, quarantined_at_ms: 1_790_000_000_000 },
  { kind: "repository_session_types", root: "/work/stale", cause: "write_unknown", detail: "session-types.toml write outcome unknown", quarantined_at_ms: 1_790_000_100_000 },
  { kind: "package", package_name: "acme.clean", original: "enable failed", compensation: "disable failed", durable: false, loaded: true, quarantined_at_ms: 1_790_000_200_000 },
  { kind: "package", package_name: "acme.throw", original: "enable failed", compensation: "disable failed", durable: false, loaded: false, quarantined_at_ms: 1_790_000_300_000 },
  { kind: "package", package_name: "acme.sentinel", original: "enable failed", compensation: "disable failed", durable: false, loaded: false, quarantined_at_ms: 1_790_000_400_000 },
  { kind: "package", package_name: "acme.overlap", original: "enable failed", compensation: "disable failed", durable: false, loaded: false, quarantined_at_ms: 1_790_000_500_000 }
];
const initialQuarantines = [...quarantines];
// While set, each status request waits until the driver answers it with releaseStatus.
let holdStatus = false;
const heldStatus: Array<(response: DaemonResponse) => void> = [];
const requests = observeLog<DaemonRequest>([]);
const held = new Map<string, { resolve: (response: DaemonResponse) => void; reject: (error: Error) => void }>();

function statusResponse(): DaemonResponse {
  return {
    kind: "status",
    status: {
      lifecycle_state: "running",
      software: { product_id: "botster-hub", product_name: "Botster Hub", version: "0.1.0" },
      installation: { mode: "development", provenance: "development_build" },
      compatibility: { protocol: "botster-hub-daemon-v1", protocol_version: 14, features: [], conformance_fixture_revision: 53 },
      host_id: "smoke-host",
      host_display_name: "Smoke Hub",
      schema_version: 5,
      data_dir_configured: true,
      core_initialized: true,
      state_source: "explicit",
      package_count: 0,
      enabled_package_count: 0,
      provider_count: 0,
      enabled_provider_count: 0,
      session_count: 0,
      recovered_sessions: [],
      stale_sessions: [],
      quarantines,
      diagnostics: []
    },
    sessions: [],
    events: [],
    diagnostics: []
  } as unknown as DaemonResponse;
}

const bridge: DaemonBridgeClient = {
  async request(request) {
    requests.push(request);
    if (request.type === "status") {
      if (!holdStatus) return statusResponse();
      return new Promise<DaemonResponse>((resolve) => {
        heldStatus.push(resolve);
        notifyWaits();
      });
    }
    if (request.type === "resolve_quarantine") {
      const key = quarantineTargetKey(request.target);
      return new Promise<DaemonResponse>((resolve, reject) => {
        held.set(key, { resolve, reject });
        notifyWaits();
      });
    }
    return { kind: "error", error: { code: "unsupported", request_id: "smoke", operation: request.type, message: "not scripted" } } as unknown as DaemonResponse;
  }
};

/** Answers the held resolve_quarantine request for one target key. */
function release(key: string, mode: ReleaseMode): void {
  const pending = held.get(key);
  if (!pending) throw new Error(`no held resolve_quarantine for ${key}`);
  held.delete(key);
  if (mode === "throw") {
    pending.reject(new Error("control channel closed"));
    return;
  }
  if (mode === "refused") {
    pending.resolve({
      kind: "operator_error",
      error: { code: "quarantine_busy", request_id: "smoke", operation: "resolve_quarantine", message: "package is still unloading" }
    } as unknown as DaemonResponse);
    return;
  }
  quarantines = quarantines.filter((entry) => quarantineKey(entry) !== key);
  pending.resolve({ kind: "quarantine_resolved", error: null } as unknown as DaemonResponse);
}

/** The Hub quarantines a resolved target again, with a new quarantined_at_ms. */
function requarantine(key: string, quarantinedAtMs: number): void {
  const template = initialQuarantines.find((entry) => quarantineKey(entry) === key);
  if (!template) throw new Error(`no quarantine template for ${key}`);
  quarantines = [...quarantines.filter((entry) => quarantineKey(entry) !== key), { ...template, quarantined_at_ms: quarantinedAtMs }];
}

/** Answers the oldest held status request: the current list, or a Hub error. */
function releaseStatus(mode: "ok" | "error"): void {
  const answer = heldStatus.shift();
  if (!answer) throw new Error("no held status request");
  answer(mode === "ok"
    ? statusResponse()
    : { kind: "error", error: { code: "status_unavailable", request_id: "smoke", operation: "status", message: "status unavailable" } } as unknown as DaemonResponse);
}

const runtimeClient = createBotsterWebClient({ transport: createHubTransport({ bridge }) });

export function HubQuarantineSmoke() {
  const [, setFrameVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const actions = useHubActions({
    runtimeClient,
    recordDiagnostic: () => undefined,
    updateLocalState: () => undefined,
    setSelectedPluginSurface: () => undefined
  });
  useEffect(() => {
    const unsubscribe = runtimeClient.hub.onFrame(() => setFrameVersion((version) => version + 1));
    void runtimeClient.hub.connect({} as Parameters<typeof runtimeClient.hub.connect>[0]).then(() => setConnected(true));
    return unsubscribe;
  }, []);
  const hubStatus = runtimeClient.entities.get("botster-web.hub_status", "local-hub");
  const toast = actions.packageActionToast;
  return (
    <div data-testid="smoke-root" data-connected={connected ? "true" : "false"}>
      <HubGeneralSection
        hubStatus={hubStatus}
        hubUpdate={actions.hubUpdate}
        onCheckForUpdates={() => undefined}
        onResolveQuarantine={(quarantine) => actions.dispatchAction(resolveQuarantineAction(quarantine))}
        quarantineOutcomes={actions.quarantineOutcomes}
      />
      {toast ? <p data-testid="smoke-toast" data-color={toast.color}>{toast.message}</p> : null}
    </div>
  );
}

(globalThis as typeof globalThis & { __BOTSTER_QUARANTINE_SMOKE__?: unknown }).__BOTSTER_QUARANTINE_SMOKE__ = {
  requests,
  held: () => [...held.keys()],
  heldStatusCount: () => heldStatus.length,
  setHoldStatus: (value: boolean) => { holdStatus = value; },
  release,
  releaseStatus,
  requarantine
};

createRoot(document.getElementById("root") as HTMLElement).render(<HubQuarantineSmoke />);
