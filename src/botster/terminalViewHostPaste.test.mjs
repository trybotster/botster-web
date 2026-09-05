// TerminalViewHost input-outcome surface and attach cancellation fence.
//
// Mounted through React on the suite's minimal DOM with a fake bridge and data plane.
// Scenarios are bounded on the real Node timer and report the awaited stage on timeout.

import { strict as assert } from "node:assert";

export async function runTerminalViewHostPasteTests({ TerminalViewHost, act, createElement, createRoot }) {
  const realSetTimeout = setTimeout;
  const realClearTimeout = clearTimeout;
  const SCENARIO_BOUND_MS = 10_000;
  let currentStage = "start";
  const stage = (label) => { currentStage = label; };
  const runScenario = async (name, body) => {
    currentStage = "start";
    let bound;
    const timeout = new Promise((_, reject) => {
      bound = realSetTimeout(() => {
        reject(new Error(`view host scenario ${name} timed out after ${SCENARIO_BOUND_MS} ms at stage: ${currentStage}`));
      }, SCENARIO_BOUND_MS);
    });
    try {
      await Promise.race([body(), timeout]);
    } finally {
      realClearTimeout(bound);
    }
  };
  const settle = async () => {
    await act(async () => {
      await new Promise((resolve) => realSetTimeout(resolve, 0));
    });
  };
  const findAll = (node, predicate, found = []) => {
    if (predicate(node)) found.push(node);
    for (const child of node.childNodes ?? []) findAll(child, predicate, found);
    return found;
  };
  const textOf = (node) => `${node.nodeType === 3 ? node.textContent ?? "" : ""}${[...(node.childNodes ?? [])].map(textOf).join("")}`;
  const inputMessage = (element) =>
    findAll(element, (node) => node.nodeType === 1 && node.className === "terminal-input-message")[0] ?? null;

  const makeDataPlane = (sessionId) => {
    const state = { statusSubscriptions: 0, statusUnsubscribes: 0, detachCount: 0 };
    return {
      state,
      dataPlane: {
        sessionId,
        writeInput() {},
        subscribeOutput: () => ({ unsubscribe() {} }),
        subscribeStatus(listener) {
          state.statusSubscriptions += 1;
          listener({ state: "attached", message: "fake attached" });
          return { unsubscribe: () => { state.statusUnsubscribes += 1; } };
        },
        detach() { state.detachCount += 1; }
      }
    };
  };
  const makeBridge = ({ attach } = {}) => {
    const calls = { mount: 0, unmount: 0, attach: 0, detach: 0, subscribeInputOutcomes: 0, outcomeUnsubscribes: 0 };
    let outcomeListener;
    let mountId = 0;
    return {
      calls,
      emitOutcome: (outcome) => outcomeListener?.(outcome),
      bridge: {
        async mount(container, descriptor) { calls.mount += 1; return { sessionId: descriptor.sessionId, mountId: ++mountId }; },
        async unmount() { calls.unmount += 1; },
        async attach() { calls.attach += 1; await attach?.(); },
        async detach() { calls.detach += 1; },
        async focus() {},
        async writeInput() {},
        async resize() {},
        subscribeInputOutcomes(_descriptor, listener) {
          calls.subscribeInputOutcomes += 1;
          outcomeListener = listener;
          return { unsubscribe: () => { calls.outcomeUnsubscribes += 1; if (outcomeListener === listener) outcomeListener = undefined; } };
        }
      }
    };
  };
  const mountHost = async (props) => {
    const element = globalThis.document.createElement("div");
    globalThis.document.body.appendChild(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(createElement(TerminalViewHost, props));
    });
    return {
      element,
      root,
      rerender: (nextProps) => act(async () => { root.render(createElement(TerminalViewHost, nextProps)); }),
      unmount: () => act(async () => { root.unmount(); })
    };
  };

  // (v1) Cleanup during a delayed attach: the continuation installs nothing afterwards.
  await runScenario("v1-delayed-attach-unmount", async () => {
    let releaseAttach;
    const attachGate = new Promise((resolve) => { releaseAttach = resolve; });
    const { bridge, calls } = makeBridge({ attach: () => attachGate });
    const { dataPlane, state } = makeDataPlane("delayed");
    const host = await mountHost({ bridge, dataPlane, descriptor: { sessionId: "delayed", renderer: "restty" } });
    stage("v1: attach requested");
    for (let round = 0; round < 40 && calls.attach === 0; round += 1) await settle();
    assert.equal(calls.attach, 1, "attach was requested");
    assert.equal(state.statusSubscriptions, 1, "status subscribed before attach");
    await host.unmount();
    stage("v1: release attach after unmount");
    releaseAttach();
    await settle();
    await settle();
    assert.equal(calls.subscribeInputOutcomes, 0, "no outcome subscription after cleanup ran during attach");
    assert.equal(state.statusUnsubscribes, 1, "status subscription released exactly once");
    assert.equal(calls.unmount >= 1, true, "cleanup unmounted the bridge mount");
    host.element.remove();
  });

  // (v2) Outcome message lifecycle: rejected shows and persists, admitted clears, unknown shows.
  await runScenario("v2-outcome-message", async () => {
    const { bridge, calls, emitOutcome } = makeBridge();
    const { dataPlane } = makeDataPlane("outcomes");
    const forwarded = [];
    const host = await mountHost({
      bridge,
      dataPlane,
      descriptor: { sessionId: "outcomes", renderer: "restty" },
      onInputOutcome: (sessionId, outcome) => forwarded.push({ sessionId, outcome: outcome.outcome })
    });
    for (let round = 0; round < 40 && calls.subscribeInputOutcomes === 0; round += 1) await settle();
    assert.equal(calls.subscribeInputOutcomes, 1, "outcome subscription installed once after attach");
    assert.equal(inputMessage(host.element), null, "no message before any outcome");
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "rejected", minimumBytes: 12, reason: "unsupported", detail: "This terminal attachment does not support clipboard paste; paste was not delivered." });
    });
    let message = inputMessage(host.element);
    assert.ok(message, "rejected outcome renders the input message");
    assert.equal(message.getAttribute("data-terminal-input-outcome"), "rejected");
    assert.match(textOf(message), /Paste rejected \(unsupported\)/);
    assert.match(textOf(message), /Dismiss/);
    await settle();
    assert.ok(inputMessage(host.element), "the message persists across renders");
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "partial", minimumBytes: 10, requestedBytes: 12, deliveredBytes: 3, operationId: 2, detail: "Terminal delivered 3 of 12 bytes before the write stopped." });
    });
    message = inputMessage(host.element);
    assert.equal(message.getAttribute("data-terminal-input-outcome"), "partial");
    assert.match(textOf(message), /partially delivered \(3 of 12 bytes\)/);
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "rejected", minimumBytes: 7, reason: "too_large", detail: "Paste of at least 7 bytes exceeds the limit." });
    });
    assert.match(textOf(inputMessage(host.element)), /Paste rejected \(too_large\)/);
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "admitted", minimumBytes: 10, requestedBytes: 12, deliveredBytes: 12, operationId: 3, detail: "Paste delivered 12 of 12 bytes." });
    });
    assert.equal(inputMessage(host.element), null, "an admitted paste clears the message");
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "unknown", minimumBytes: 10, requestedBytes: 12, operationId: 4, reason: "timeout", detail: "Terminal reported a timeout for the paste; delivery of 12 bytes is unknown." });
    });
    message = inputMessage(host.element);
    assert.equal(message.getAttribute("data-terminal-input-outcome"), "unknown");
    assert.match(textOf(message), /Paste delivery unknown/);
    assert.deepEqual(forwarded.map((entry) => entry.outcome), ["rejected", "partial", "rejected", "admitted", "unknown"]);
    assert.ok(forwarded.every((entry) => entry.sessionId === "outcomes"));

    // (v3) A replacement session starts without the previous session's message.
    const replacement = makeDataPlane("replacement");
    await host.rerender({
      bridge,
      dataPlane: replacement.dataPlane,
      descriptor: { sessionId: "replacement", renderer: "restty" },
      onInputOutcome: (sessionId, outcome) => forwarded.push({ sessionId, outcome: outcome.outcome })
    });
    await settle();
    assert.equal(inputMessage(host.element), null, "replacement session shows no old-session input message");
    assert.equal(calls.outcomeUnsubscribes >= 1, true, "the old outcome subscription was released");
    await host.unmount();
    host.element.remove();
  });
}
