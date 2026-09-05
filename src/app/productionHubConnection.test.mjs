// Mounted useProductionHubConnection over the real client and daemon transport.
//
// Every scenario mounts the actual hook through createBotsterWebClient and the real
// createHubTransport. Only the daemon bridge is controlled. The shipped daemon transport
// resolves surface_subscribe without a bridge call, so surface pending/failure cases wrap
// the real transport send for that one frame kind and pass every other frame through.
//
// Startup contract under test:
// - connect (status) and subscribe (session entity subscription) are essential prerequisites.
// - session load status completes when the session subscription is ready, before any
//   optional request settles.
// - optional pulls and the production surface subscription cannot block session discovery
//   or report a connection failure.
// - cancellation during connect, subscribe, or optional work leaves no later state writes.
// Reconnect recovery is out of scope here.

import { strict as assert } from "node:assert";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";

const SCENARIOS = [
  "optional",
  "surface_pending",
  "surface_failure",
  "connect_failure",
  "subscribe_failure",
  "cancel_connect",
  "cancel_subscribe",
  "cancel_optional"
];

const FAILURE_SCENARIOS = new Set(["connect_failure", "subscribe_failure"]);
const OPTIONAL_CALLS = [
  "list_apps",
  "list_package_navigation",
  "list_packages",
  "list_spawn_targets",
  "subscribe:session_type",
  "surface_subscribe"
];

const SESSION_FRAME = {
  type: "entity_upsert",
  entity_type: "session",
  subscription_id: "startup-test",
  snapshot_seq: 1,
  id: "startup-session",
  entity: {
    session_uuid: "startup-session",
    registry_state: "active",
    lifecycle: "running",
    lifecycle_class: "current",
    rows: 24,
    cols: 80,
    updated_at: 1
  }
};

// Drain every microtask chain started by the hook (promise hops plus queueMicrotask frame
// delivery) inside act so state writes are flushed and observable.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function textOf(node) {
  return `${node.textContent ?? ""}${[...(node.childNodes ?? [])].map(textOf).join("")}`;
}

export async function runProductionHubConnectionTests() {
  const vite = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error"
  });
  try {
    const { ProductionHubConnectionHarness } = await vite.ssrLoadModule(
      "/src/app/__fixtures__/productionHubConnectionHarness.tsx"
    );
    const { createHubTransport } = await vite.ssrLoadModule("/src/botster/hubTransport.ts");
    const { createBotsterWebClient } = await vite.ssrLoadModule("/src/botster/client.ts");

    for (const scenario of SCENARIOS) {
      let resolvePending;
      let rejectPending;
      const pending = new Promise((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
      const calls = [];
      const subscriptions = [];
      const diagnostics = [];
      const actions = [];
      let loads = {};
      const response = { kind: "status", status: null, sessions: [], packages: [], events: [], error: null };

      const bridge = {
        async request(request) {
          calls.push(request.type);
          if (request.type === "status" && calls.length === 1) {
            if (scenario === "connect_failure") throw new Error("connect test failure");
            if (scenario === "cancel_connect") return pending;
          }
          if (request.type === "list_package_navigation" && ["optional", "cancel_optional"].includes(scenario)) {
            return pending;
          }
          if (request.type === "list_packages" && scenario === "optional") {
            throw new Error("package test failure");
          }
          return response;
        },
        subscribeEntityFrames(entityType, onFrame) {
          calls.push(`subscribe:${entityType}`);
          subscriptions.push({ entityType, onFrame });
          let ready = Promise.resolve();
          if (entityType === "session" && scenario === "subscribe_failure") {
            ready = Promise.reject(new Error("subscribe test failure"));
          } else if (entityType === "session" && scenario === "cancel_subscribe") {
            ready = pending;
          }
          return { ready, unsubscribe() { calls.push(`unsubscribe:${entityType}`); } };
        },
        disconnect() {
          calls.push("disconnect");
        }
      };

      const realTransport = createHubTransport({ bridge });
      const transport = {
        ...realTransport,
        send(frame) {
          if (frame.kind === "surface_subscribe") {
            calls.push(frame.kind);
            if (scenario === "surface_pending") return pending;
            if (scenario === "surface_failure") return Promise.reject(new Error("surface test failure"));
          }
          return realTransport.send(frame);
        }
      };
      const runtimeClient = createBotsterWebClient({ transport });

      const element = globalThis.document.createElement("div");
      globalThis.document.body.appendChild(element);
      const root = createRoot(element);
      let mounted = true;
      try {
        await act(async () => {
          root.render(
            createElement(ProductionHubConnectionHarness, {
              runtimeClient,
              recordDiagnostic: (value) => {
                if (value) diagnostics.push(value);
              },
              recordDiagnostics: (values) => diagnostics.push(...values),
              updateLocalState: (value) => actions.push(value),
              onLoads: (value) => {
                loads = value;
              }
            })
          );
        });
        await settle();

        // Essential prerequisites always run first and in order.
        assert.equal(calls[0], "status", scenario);
        if (scenario !== "connect_failure" && scenario !== "cancel_connect") {
          assert.equal(calls[1], "subscribe:session", scenario);
        }

        if (FAILURE_SCENARIOS.has(scenario)) {
          // An essential failure is a connection failure: no optional work, one visible status.
          for (const call of OPTIONAL_CALLS) assert.equal(calls.includes(call), false, `${scenario}: ${call}`);
          assert.notEqual(loads.session, "loaded", scenario);
          assert.equal(actions.length, 1, scenario);
          assert.match(String(actions[0]["production.action_status"]), /test failure/, scenario);
          const expectedId = scenario === "connect_failure" ? "hub-unavailable" : "stream-disconnected";
          assert.ok(diagnostics.some((entry) => entry.id === expectedId), `${scenario}: ${expectedId}`);
          assert.equal(diagnostics.some((entry) => entry.id.startsWith("entity-load-")), false, scenario);
          continue;
        }

        if (scenario.startsWith("cancel_")) {
          if (scenario === "cancel_connect") {
            assert.equal(calls.includes("subscribe:session"), false, scenario);
          }
          if (scenario !== "cancel_optional") {
            for (const call of OPTIONAL_CALLS) assert.equal(calls.includes(call), false, `${scenario}: ${call}`);
          }
          await act(async () => root.unmount());
          mounted = false;
          assert.ok(calls.includes("disconnect"), scenario);
          const before = {
            calls: [...calls],
            diagnostics: [...diagnostics],
            actions: [...actions],
            loads: { ...loads }
          };
          await act(async () => {
            if (scenario === "cancel_optional") rejectPending(new Error("late optional failure"));
            else resolvePending(response);
          });
          await settle();
          // Late settlement after unmount writes nothing: no calls, diagnostics, status, or loads.
          assert.deepEqual({ calls, diagnostics, actions, loads }, before, scenario);
          continue;
        }

        // Session load status completes from subscription readiness alone, while optional
        // requests are still pending, and no failure is reported.
        assert.equal(loads.session, "loaded", scenario);
        assert.equal(actions.length, 0, scenario);
        assert.equal(diagnostics.some((entry) => entry.severity === "danger"), false, scenario);
        for (const call of OPTIONAL_CALLS) assert.ok(calls.includes(call), `${scenario}: ${call}`);
        assert.ok(calls.indexOf("list_apps") > calls.indexOf("subscribe:session"), scenario);
        assert.equal(loads.hubStatus, "loaded", scenario);
        assert.equal(loads.app, "loaded", scenario);
        assert.equal(loads.availablePackage, "loaded", scenario);
        assert.equal(loads.spawnTarget, "loaded", scenario);
        assert.equal(loads.sessionType, "loaded", scenario);

        // Real entity rows arrive through the actual session subscription and render.
        const session = subscriptions.find((entry) => entry.entityType === "session");
        assert.ok(session, scenario);
        await act(async () => session.onFrame(SESSION_FRAME));
        await settle();
        assert.equal(loads.session, "loaded", scenario);
        assert.ok(runtimeClient.entities.list("session").some((row) => row.id === "startup-session"), scenario);
        assert.match(textOf(element), /startup-session/, scenario);

        if (scenario === "optional") {
          assert.equal(loads.packageNavigation, "loading", scenario);
          assert.equal(loads.package, "error", scenario);
          const packageDiagnostic = diagnostics.find((entry) => entry.id === "entity-load-package");
          assert.ok(packageDiagnostic, scenario);
          assert.equal(packageDiagnostic.severity, "warning", scenario);
          assert.match(packageDiagnostic.detail, /package test failure/, scenario);
          // Eventual optional completion updates its own load key only.
          await act(async () => resolvePending(response));
          await settle();
          assert.equal(loads.packageNavigation, "loaded", scenario);
          assert.equal(loads.package, "error", scenario);
          assert.equal(loads.session, "loaded", scenario);
          assert.equal(actions.length, 0, scenario);
        }
        if (scenario === "surface_pending") {
          assert.equal(diagnostics.some((entry) => entry.id === "production-surface-load"), false, scenario);
        }
        if (scenario === "surface_failure") {
          const surfaceDiagnostic = diagnostics.find((entry) => entry.id === "production-surface-load");
          assert.ok(surfaceDiagnostic, scenario);
          assert.equal(surfaceDiagnostic.severity, "warning", scenario);
          assert.equal(actions.length, 0, scenario);
        }
      } finally {
        if (mounted) await act(async () => root.unmount());
        element.remove();
      }
    }
  } finally {
    await vite.close();
  }
}
