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
      for (const host of mountedHosts.splice(0)) {
        await host.unmount().catch(() => undefined);
        if (host.element.parentNode) host.element.parentNode.removeChild(host.element);
      }
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
  // The suite's minimal DOM stores React's class assignment through setAttribute("class") and
  // keeps an element's textContent independent of its childNodes. Read the class from the
  // attribute with a className fallback, and read text from child nodes when present,
  // otherwise from the element's own textContent, so nothing is double-counted.
  const classOf = (node) => (typeof node.getAttribute === "function" ? node.getAttribute("class") : null) ?? node.className ?? "";
  const textOf = (node) => {
    if (node.nodeType === 3) return node.textContent ?? "";
    const children = [...(node.childNodes ?? [])];
    return children.length > 0 ? children.map(textOf).join("") : (node.textContent ?? "");
  };
  const inputMessage = (element) =>
    findAll(element, (node) => node.nodeType === 1 && classOf(node) === "terminal-input-message")[0] ?? null;

  const makeDataPlane = (sessionId) => {
    const state = { statusSubscriptions: 0, statusUnsubscribes: 0, detachCount: 0 };
    return {
      state,
      dataPlane: {
        sessionId,
        sendInput() {},
        async writePaste(text) {
          return { kind: "paste", outcome: "rejected_locally", requestedBytes: text.length, reason: "fake", detail: "fake data plane" };
        },
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
        async writeRawInput() {},
        async resize() {},
        subscribeInputOutcomes(_descriptor, listener) {
          calls.subscribeInputOutcomes += 1;
          outcomeListener = listener;
          return { unsubscribe: () => { calls.outcomeUnsubscribes += 1; if (outcomeListener === listener) outcomeListener = undefined; } };
        }
      }
    };
  };
  // Every mounted host is unmounted and removed when its scenario ends, also after a failure.
  const mountedHosts = [];
  const mountHost = async (props) => {
    const element = globalThis.document.createElement("div");
    globalThis.document.body.appendChild(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(createElement(TerminalViewHost, props));
    });
    let mounted = true;
    const host = {
      element,
      root,
      rerender: (nextProps) => act(async () => { root.render(createElement(TerminalViewHost, nextProps)); }),
      unmount: async () => {
        if (!mounted) return;
        mounted = false;
        await act(async () => { root.unmount(); });
      }
    };
    mountedHosts.push(host);
    return host;
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
    // The scenario: cleanup runs while attach is still pending.
    stage("v1: unmount during pending attach");
    await host.unmount();
    assert.equal(calls.unmount >= 1, true, "cleanup unmounted the bridge mount before attach released");
    assert.equal(state.statusUnsubscribes, 1, "cleanup released the status subscription before attach released");
    stage("v1: release attach after unmount");
    releaseAttach();
    await settle();
    await settle();
    assert.equal(calls.subscribeInputOutcomes, 0, "no outcome subscription after cleanup ran during attach");
    assert.equal(state.statusUnsubscribes, 1, "the fenced continuation did not release the status subscription twice");
  });

  // (v2) Outcome message lifecycle: a rejection shows and persists, written clears, unknown shows.
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
      emitOutcome({ kind: "paste", outcome: "rejected_locally", requestedBytes: 12, reason: "unsupported", detail: "This terminal attachment does not support clipboard paste; paste was not delivered." });
    });
    let message = inputMessage(host.element);
    assert.ok(message, "rejected outcome renders the input message");
    assert.equal(message.getAttribute("data-terminal-input-outcome"), "rejected_locally");
    assert.match(textOf(message), /Paste rejected \(unsupported\)/);
    assert.match(textOf(message), /Dismiss/);
    await settle();
    assert.ok(inputMessage(host.element), "the message persists across renders");
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "partial_write", requestedBytes: 12, writtenPtyBytes: 3, operationId: 2, detail: "The PTY write stopped after 3 PTY bytes written." });
    });
    message = inputMessage(host.element);
    assert.equal(message.getAttribute("data-terminal-input-outcome"), "partial_write");
    assert.match(textOf(message), /Paste partially delivered \(3 PTY bytes written for 12 bytes\)/);
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "rejected_too_large", requestedBytes: 7, operationId: 5, detail: "Terminal reported rejected_too_large for the paste operation." });
    });
    assert.match(textOf(inputMessage(host.element)), /Paste rejected: 7 bytes exceeds the limit/);
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "written", requestedBytes: 12, acceptedPayloadBytes: 12, writtenPtyBytes: 12, operationId: 3, detail: "Terminal accepted the paste operation; 12 PTY bytes written." });
    });
    assert.equal(inputMessage(host.element), null, "a written paste clears the message");
    await act(async () => {
      emitOutcome({ kind: "paste", outcome: "outcome_unknown", requestedBytes: 12, operationId: 4, detail: "Terminal stream was lost after the paste was sent; delivery of 12 bytes is unknown." });
    });
    message = inputMessage(host.element);
    assert.equal(message.getAttribute("data-terminal-input-outcome"), "outcome_unknown");
    assert.match(textOf(message), /Paste delivery unknown/);
    assert.deepEqual(forwarded.map((entry) => entry.outcome), ["rejected_locally", "partial_write", "rejected_too_large", "written", "outcome_unknown"]);
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
  });
}
