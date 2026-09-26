// Clipboard paste through HubTerminalDataPlane over the real WebrtcDaemonTransport.
//
// Each scenario attaches a real HubTerminalDataPlane to a real WebrtcDaemonTransport with
// fake peers, completes the actual terminal admission (reservation, reserved-channel Hello,
// then the route order ATTACH_STATE attached, MODES, SNAPSHOT_READY, one history page,
// SNAPSHOT_FINISH), then calls writePaste and reassembles the exact binary input chunks the
// plane sent on the reserved channel. Results arrive as real INPUT_RESULT bodies. Web never
// adds bracketed-paste markers and never retries a paste.
//
// Named bounded scenarios on the real Node timer report the awaited stage on timeout.

import { strict as assert } from "node:assert";

export async function runTerminalPasteTests(helpers) {
  const {
    createFakeDataChannel,
    createFakePeerConnection,
    installAutoHelloAck,
    fakeHubTerminalGenerations,
    recorder,
    notifyTestProgress,
    waitForTestCondition,
    decryptTestEnvelope,
    emitChunkedTestResponse,
    flushMicrotasks,
    localWebrtcBootstrapFixture,
    createWebrtcDaemonClient,
    createHubTerminalDataPlane,
    bindGhostsnpInstaller,
    emitTestTerminalBody,
    sentTestInputFrames,
    standardAttachFrames,
    inputResultBody,
    inputFrameHeader,
    terminalProtocolModule,
    requireRuntime
  } = helpers;
  const secret = localWebrtcBootstrapFixture.grant_secret;
  const { MAX_PASTE_BYTES, MAX_PASTE_CHUNK_DATA_BYTES, TerminalInputKind, ModeBits, encodePaste } = terminalProtocolModule;
  const { MAX_QUEUED_INPUT_BYTES, MAX_QUEUED_INPUT_OPERATIONS, MAX_INFLIGHT_INPUT_OPERATIONS } = requireRuntime("./botster/hubTerminalDataPlane.js");
  const { localWebrtcInboundAdmissionLimits } = requireRuntime("./botster/webrtcDaemonClient.js");
  const { BotsterTerminalPtyTransport } = requireRuntime("./botster/botsterTerminalPtyTransport.js");

  const realSetTimeout = setTimeout;
  const realClearTimeout = clearTimeout;
  const SCENARIO_BOUND_MS = 20_000;
  for (const [name, value] of Object.entries({ MAX_PASTE_BYTES, MAX_PASTE_CHUNK_DATA_BYTES, MAX_QUEUED_INPUT_BYTES })) {
    assert.ok(Number.isInteger(value) && value > 0, `${name} must be a finite positive integer, observed ${String(value)}`);
  }
  let currentStage = "start";
  const stage = (label) => { currentStage = label; };
  const scenarioFixtures = recorder();
  const cleanupFixture = async (fixture) => {
    try {
      await Promise.race([
        Promise.resolve(fixture.plane?.detach?.()).catch(() => undefined),
        new Promise((resolve) => realSetTimeout(resolve, 1_000))
      ]);
    } finally {
      fixture.client?.disconnect?.();
    }
  };
  const runScenario = async (name, body) => {
    currentStage = `${name}: start`;
    scenarioFixtures.length = 0;
    let bound;
    const timeout = new Promise((_, reject) => {
      bound = realSetTimeout(() => {
        reject(new Error(`paste scenario ${name} timed out after ${SCENARIO_BOUND_MS} ms at stage: ${currentStage}`));
      }, SCENARIO_BOUND_MS);
    });
    try {
      await Promise.race([body(), timeout]);
    } finally {
      realClearTimeout(bound);
      for (const fixture of scenarioFixtures.splice(0)) await cleanupFixture(fixture);
    }
  };
  const waitCondition = async (predicate, label) => {
    stage(label);
    await waitForTestCondition(predicate, { label, deadlineMs: 2_000 });
  };

  const kindName = (kind) => Object.entries(TerminalInputKind).find(([, value]) => value === kind)?.[0] ?? String(kind);
  const decodeFrame = ({ frame }) => {
    const header = inputFrameHeader(frame);
    return { ...header, name: kindName(header.kind), body: frame.subarray(12), bytes: frame };
  };
  const beginHeader = (body) => {
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    return { totalLength: view.getUint32(0, false), allowUnsafe: body[4] === 1 };
  };
  const chunkBody = (body) => {
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    return { index: view.getUint32(0, false), data: body.subarray(4) };
  };

  /**
   * One attached plane over a real transport. `modeBits` shapes the MODES frame. Control
   * attach and detach requests are answered by the responder; nothing else is requested.
   */
  const attachPlane = async (name, { modeBits = ModeBits.CURSOR_VISIBLE, autoAckTerminal = true, testHooks } = {}) => {
    const channels = recorder();
    const client = createWebrtcDaemonClient({
      bootstrap: localWebrtcBootstrapFixture,
      peerConnectionFactory: () => {
        const channel = createFakeDataChannel();
        installAutoHelloAck(channel, secret);
        channels.push(channel);
        return createFakePeerConnection(channel, secret, { autoAckTerminal });
      },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          payload: { local_webrtc_answer: { grant_id: localWebrtcBootstrapFixture.grant_id, answer: { type: "answer", sdp: "answer-sdp" } } }
        })
      })
    });
    const sessionId = `paste-${name}-session`;
    const generation = 9200;
    const statuses = recorder();
    const outputs = recorder();
    const outcomes = recorder();
    const plane = createHubTerminalDataPlane({ sessionId, bridge: client, testHooks });
    const fixtureRecord = { client, plane };
    scenarioFixtures.push(fixtureRecord);
    bindGhostsnpInstaller(plane);
    plane.subscribeStatus((status) => statuses.push(status));
    plane.subscribeOutput((data) => outputs.push(data));
    plane.subscribeInputOutcomes((outcome) => outcomes.push(outcome));
    await waitCondition(() => channels.length === 1 && channels[0].sent.length >= 1, `${name}: attach request`);
    const control = channels[0];
    const answered = new Set();
    let responderPass;
    const answerControl = () => {
      responderPass ??= runResponderPass().finally(() => { responderPass = undefined; });
      return responderPass;
    };
    const runResponderPass = async () => {
      for (const [index, sent] of control.sent.entries()) {
        if (answered.has(index) || typeof sent !== "string") continue;
        const request = await decryptTestEnvelope(secret, sent);
        if (request?.type === "attach") {
          answered.add(index);
          // Protocol 10: the fake Hub names the Core generation in the reserved channel's HelloAck.
          fakeHubTerminalGenerations.set(`r-${name}-${request.subscription_id}`, generation);
          await emitChunkedTestResponse(control, secret, {
            kind: "terminal_reservation",
            terminal_reservation: {
              session_id: sessionId,
              subscription_id: request.subscription_id,
              peer_generation: 1,
              label: `r-${name}-${request.subscription_id}`,
              expires_in_seconds: 30
            },
            events: recorder()
          }, { messageId: `${name}-reservation-${index}`, requestType: "attach" });
        } else if (request?.type === "detach") {
          answered.add(index);
          await emitChunkedTestResponse(control, secret, { kind: "events", events: recorder() }, { messageId: `${name}-detach-${index}`, requestType: "detach" });
        }
      }
    };
    const admit = async (ordinal) => {
      let attach;
      await waitCondition(async () => {
        await answerControl();
        const requests = await Promise.all(control.sent.map((sent) => (typeof sent === "string" ? decryptTestEnvelope(secret, sent) : null)));
        attach = requests.filter((request) => request?.type === "attach")[ordinal];
        return Boolean(attach);
      }, `${name}: attach request ${ordinal}`);
      const subscriptionId = attach.subscription_id;
      const label = `r-${name}-${subscriptionId}`;
      await waitCondition(
        () => control.createdDataChannels.some((channel) => channel.label === label && channel.helloAckDelivered === true),
        `${name}: reserved channel Hello ${ordinal}`
      );
      const terminal = control.createdDataChannels.find((channel) => channel.label === label);
      const attachedBefore = statuses.filter((status) => status.state === "attached").length;
      for (const frame of standardAttachFrames(subscriptionId, { generation, modeBits })) {
        await emitTestTerminalBody(terminal, secret, { generation, streamEpoch: 0 }, frame.body);
      }
      await waitCondition(
        () => statuses.filter((status) => status.state === "attached").length > attachedBefore,
        `${name}: attached ${ordinal}`
      );
      const sentBefore = terminal.sent.length;
      const result = (operationId, outcome, options) =>
        emitTestTerminalBody(terminal, secret, { generation, streamEpoch: 0 }, inputResultBody(operationId, outcome, { modeBits, ...options }));
      const framesSince = async () => {
        // Polled while sends are in progress: only complete messages count as frames.
        const frames = await sentTestInputFrames({ sent: terminal.sent.slice(sentBefore) }, secret, { allowTrailingPartial: true });
        return frames.map(decodeFrame);
      };
      // Strict reassembly at a scenario's completion point: every message complete.
      const assertComplete = async () => {
        await sentTestInputFrames({ sent: terminal.sent.slice(sentBefore) }, secret);
      };
      return { terminal, subscriptionId, result, framesSince, assertComplete };
    };
    const first = await admit(0);
    return { client, control, plane, statuses, outputs, outcomes, sessionId, answerControl, admit, ...first };
  };
  const waitFrameCount = async (fixture, count, label) => {
    let frames = recorder();
    await waitCondition(async () => {
      await fixture.answerControl?.();
      frames = await fixture.framesSince();
      return frames.length >= count;
    }, label);
    return frames;
  };

  try {
    // (p1) 70,000-byte ASCII paste: one operation, BEGIN, two chunks, COMMIT, byte-identical content.
    await runScenario("p1-large-ascii", async () => {
      const fixture = await attachPlane("p1");
      const text = `botster-paste:${"p".repeat(70_000 - 14)}`;
      assert.equal(new TextEncoder().encode(text).byteLength, 70_000);
      const pending = fixture.plane.writePaste(text);
      const frames = await waitFrameCount(fixture, 4, "p1: begin, two chunks, commit");
      assert.deepEqual(frames.map((frame) => frame.name), ["paste_begin", "paste_chunk", "paste_chunk", "paste_commit"]);
      assert.deepEqual(new Set(frames.map((frame) => frame.operationId)), new Set([1]), "one operation id for the whole paste");
      assert.deepEqual(beginHeader(frames[0].body), { totalLength: 70_000, allowUnsafe: false });
      const first = chunkBody(frames[1].body);
      const second = chunkBody(frames[2].body);
      assert.equal(first.index, 0);
      assert.equal(second.index, 1);
      assert.equal(first.data.byteLength, MAX_PASTE_CHUNK_DATA_BYTES);
      assert.equal(second.data.byteLength, 70_000 - MAX_PASTE_CHUNK_DATA_BYTES);
      assert.equal(new TextDecoder().decode(Buffer.concat([first.data, second.data])), text, "received content is byte-identical");
      // The frames equal the generated encoder's output for the same inputs: Web adds nothing.
      const expected = encodePaste(1, false, new TextEncoder().encode(text));
      assert.deepEqual(frames.map((frame) => Buffer.from(frame.bytes)), expected.map((frame) => Buffer.from(frame)));
      await fixture.result(1, "written", { accepted: 70_000, written: 70_012 });
      stage("p1: outcome");
      const outcome = await pending;
      assert.deepEqual(
        { kind: outcome.kind, outcome: outcome.outcome, requestedBytes: outcome.requestedBytes, acceptedPayloadBytes: outcome.acceptedPayloadBytes, writtenPtyBytes: outcome.writtenPtyBytes, operationId: outcome.operationId },
        { kind: "paste", outcome: "written", requestedBytes: 70_000, acceptedPayloadBytes: 70_000, writtenPtyBytes: 70_012, operationId: 1 }
      );
      assert.equal(fixture.outcomes.length, 1, "the outcome is also published to outcome subscribers");
      await fixture.assertComplete();
    });

    // (p2) Unicode paste: UTF-8 byte length above UTF-16 length, exact content.
    await runScenario("p2-unicode", async () => {
      const fixture = await attachPlane("p2");
      const text = "héllo wörld — €12 😀 日本語 ✓\n".repeat(3_000);
      const bytes = new TextEncoder().encode(text).byteLength;
      assert.ok(bytes > text.length && bytes > MAX_PASTE_CHUNK_DATA_BYTES, "unicode fixture spans chunks and exceeds its char count");
      const pending = fixture.plane.writePaste(text);
      const expectedChunks = Math.ceil(bytes / MAX_PASTE_CHUNK_DATA_BYTES);
      const frames = await waitFrameCount(fixture, expectedChunks + 2, "p2: frames");
      assert.equal(beginHeader(frames[0].body).totalLength, bytes);
      const data = Buffer.concat(frames.slice(1, -1).map((frame) => chunkBody(frame.body).data));
      assert.equal(new TextDecoder().decode(data), text);
      await fixture.result(1, "written", { accepted: bytes, written: bytes });
      const outcome = await pending;
      assert.equal(outcome.outcome, "written");
      assert.equal(outcome.requestedBytes, bytes, "requested bytes are the exact UTF-8 size");
      assert.equal(outcome.writtenPtyBytes, bytes);
      await fixture.assertComplete();
    });

    // (p3) Bracketed paste on and off: byte-identical frames; the worker adds the markers.
    await runScenario("p3-bracketed-modes", async () => {
      const text = "bracket-me\n";
      const collected = recorder();
      for (const bracketed of [false, true]) {
        const fixture = await attachPlane(`p3-${bracketed ? "on" : "off"}`, {
          modeBits: bracketed ? ModeBits.CURSOR_VISIBLE | ModeBits.BRACKETED_PASTE : ModeBits.CURSOR_VISIBLE
        });
        const pending = fixture.plane.writePaste(text);
        const frames = await waitFrameCount(fixture, 3, `p3 ${bracketed}: frames`);
        collected.push(frames.map((frame) => Buffer.from(frame.bytes).toString("hex")).join("|"));
        const content = new TextDecoder().decode(chunkBody(frames[1].body).data);
        assert.equal(content, text);
        assert.equal(content.includes("\x1b[200~"), false, "no bracketed-paste opener from Web");
        await fixture.result(1, "written", { accepted: text.length, written: bracketed ? text.length + 12 : text.length });
        const outcome = await pending;
        assert.equal(outcome.outcome, "written");
        assert.equal(outcome.writtenPtyBytes, bracketed ? text.length + 12 : text.length, "PTY bytes include the worker's markers");
        await fixture.assertComplete();
      }
      assert.equal(collected[0], collected[1], "frames are identical under bracketed paste off and on");
    });

    // (p4) Every result outcome reaches the caller once; nothing is retried.
    await runScenario("p4-results", async () => {
      const fixture = await attachPlane("p4");
      let expectedFrames = 0;
      let operationId = 0;
      const cases = [
        ["rejected_unsafe_paste", {}, { detail: /rejected_unsafe_paste/ }],
        ["rejected_lane_full", {}, { detail: /rejected_lane_full/ }],
        ["rejected_too_large", {}, { detail: /rejected_too_large/ }],
        ["write_failed", { accepted: 10, written: 0, detail: "EIO" }, { writtenPtyBytes: 0, detail: /EIO/ }],
        ["partial_write", { accepted: 10, written: 3 }, { writtenPtyBytes: 3, detail: /stopped after 3 PTY bytes/ }],
        ["outcome_unknown", {}, { detail: /outcome_unknown/ }],
        ["session_ended", {}, { detail: /session_ended/ }],
        ["cancelled", { accepted: 10, written: 2 }, { writtenPtyBytes: 2, detail: /cancelled/ }]
      ];
      for (const [outcomeName, counts, expected] of cases) {
        operationId += 1;
        const pending = fixture.plane.writePaste("reject-me\n");
        expectedFrames += 3;
        await waitFrameCount(fixture, expectedFrames, `p4 ${outcomeName}: commit`);
        await fixture.result(operationId, outcomeName, counts);
        const outcome = await pending;
        assert.equal(outcome.outcome, outcomeName, outcomeName);
        assert.equal(outcome.operationId, operationId, outcomeName);
        assert.equal(outcome.requestedBytes, 10, outcomeName);
        assert.equal(outcome.unsafePasteConsent, undefined, `${outcomeName}: no exact zero-write consent`);
        if (expected.writtenPtyBytes !== undefined) assert.equal(outcome.writtenPtyBytes, expected.writtenPtyBytes, outcomeName);
        else assert.equal(outcome.writtenPtyBytes, undefined, `${outcomeName}: unknown counts are absent, never zero`);
        assert.match(outcome.detail, expected.detail, outcomeName);
        await flushMicrotasks();
        assert.equal((await fixture.framesSince()).length, expectedFrames, `${outcomeName}: no retry frames`);
      }
      await fixture.assertComplete();
    });

    // (p5) Bounds: size before encoding, one assembling paste per route, retained bytes across
    // queued and in-flight operations.
    await runScenario("p5-bounds", async () => {
      const fixture = await attachPlane("p5");
      const tooLarge = await fixture.plane.writePaste("x".repeat(MAX_PASTE_BYTES + 1));
      assert.equal(tooLarge.outcome, "rejected_locally");
      assert.equal(tooLarge.reason, "too_large");
      assert.equal(tooLarge.requestedBytes, undefined, "refused before encoding reports no exact byte count");
      const empty = await fixture.plane.writePaste("");
      assert.equal(empty.reason, "empty");
      assert.equal((await fixture.framesSince()).length, 0, "no frames for refused pastes");

      // Two pastes queue in order and are sent contiguously: the second paste's BEGIN follows
      // the first paste's COMMIT on the wire, without waiting for the first result.
      const firstPaste = fixture.plane.writePaste("first\n");
      const secondPaste = fixture.plane.writePaste("second\n");
      const bothFrames = await waitFrameCount(fixture, 6, "p5: both paste commits");
      assert.deepEqual(bothFrames.map((frame) => [frame.name, frame.operationId]), [
        ["paste_begin", 1], ["paste_chunk", 1], ["paste_commit", 1],
        ["paste_begin", 2], ["paste_chunk", 2], ["paste_commit", 2]
      ]);
      await fixture.result(1, "written", { accepted: 6, written: 6 });
      assert.equal((await firstPaste).outcome, "written");
      await fixture.result(2, "written", { accepted: 7, written: 7 });
      assert.equal((await secondPaste).outcome, "written");

      // Retained bytes: two 1 MiB pastes (one in flight, one queued) fill the 2 MiB bound.
      assert.equal(MAX_QUEUED_INPUT_BYTES, 2 * MAX_PASTE_BYTES);
      const big = "b".repeat(MAX_PASTE_BYTES);
      const bigA = fixture.plane.writePaste(big);
      const bigB = fixture.plane.writePaste(big);
      const bigC = await fixture.plane.writePaste("c");
      assert.equal(bigC.outcome, "rejected_locally");
      assert.equal(bigC.reason, "queue_bounds");
      const bigFrames = Math.ceil(MAX_PASTE_BYTES / MAX_PASTE_CHUNK_DATA_BYTES) + 2;
      await waitFrameCount(fixture, 6 + bigFrames, "p5: big A commit");
      await fixture.result(3, "written", { accepted: MAX_PASTE_BYTES, written: MAX_PASTE_BYTES });
      assert.equal((await bigA).outcome, "written");
      await waitFrameCount(fixture, 6 + 2 * bigFrames, "p5: big B commit");
      await fixture.result(4, "written", { accepted: MAX_PASTE_BYTES, written: MAX_PASTE_BYTES });
      assert.equal((await bigB).outcome, "written");
      // Counters released: the next paste is sent, not refused.
      const afterPending = fixture.plane.writePaste("c");
      await waitFrameCount(fixture, 6 + 2 * bigFrames + 3, "p5: post-release commit");
      await fixture.result(5, "written", { accepted: 1, written: 1 });
      assert.equal((await afterPending).outcome, "written");
      await fixture.assertComplete();
    });

    // (p6) Ordering: keys keep their place around a paste; a resize never lands inside
    // BEGIN..COMMIT; one geometry operation is in flight at a time; ids increase in send order.
    await runScenario("p6-ordering", async () => {
      const fixture = await attachPlane("p6");
      const noMods = { shift: false, ctrl: false, alt: false, super: false, capsLock: false, numLock: false };
      const key = (text) => fixture.plane.sendInput({ kind: "key", action: "press", code: `Key${text.toUpperCase()}`, key: text, mods: noMods, text, composing: false, unshiftedCodepoint: text.codePointAt(0) });
      key("a");
      const paste = fixture.plane.writePaste("PASTE\n");
      key("b");
      fixture.plane.resize({ rows: 30, cols: 100, widthPx: 1000, heightPx: 600 });
      const frames = await waitFrameCount(fixture, 6, "p6: key, paste, key, resize");
      assert.deepEqual(frames.map((frame) => frame.name), ["key", "paste_begin", "paste_chunk", "paste_commit", "key", "resize"]);
      assert.deepEqual(frames.map((frame) => frame.operationId), [1, 2, 2, 2, 3, 4]);
      assert.equal(new TextDecoder().decode(frames[4].body.subarray(12)), "b");
      await fixture.result(2, "written", { accepted: 6, written: 6 });
      assert.equal((await paste).outcome, "written");
      // One geometry operation at a time: a newer geometry waits for the in-flight RESIZE's
      // result, and it never lands inside a paste's BEGIN..COMMIT.
      const laterPaste = fixture.plane.writePaste("later\n");
      fixture.plane.resize({ rows: 31, cols: 101, widthPx: 1010, heightPx: 620 });
      const pasted = await waitFrameCount(fixture, 9, "p6: later paste");
      assert.deepEqual(pasted.slice(6).map((frame) => frame.name), ["paste_begin", "paste_chunk", "paste_commit"]);
      await fixture.result(4, "written", { accepted: 0, written: 0 });
      const later = await waitFrameCount(fixture, 10, "p6: newer resize after the RESIZE result");
      assert.equal(later[9].name, "resize");
      await fixture.result(5, "written", { accepted: 6, written: 6 });
      assert.equal((await laterPaste).outcome, "written");
      await fixture.assertComplete();
    });

    // (p7) A chunk send that fails mid-paste cancels the operation and aborts it best effort.
    await runScenario("p7-cancel-before-commit", async () => {
      const fixture = await attachPlane("p7");
      const originalSend = fixture.terminal.send.bind(fixture.terminal);
      let binarySends = 0;
      fixture.terminal.send = (data) => {
        if (typeof data !== "string") {
          binarySends += 1;
          if (binarySends === 2) throw new Error("chunk send failed");
        }
        originalSend(data);
      };
      const outcome = await fixture.plane.writePaste("cancel-me\n");
      assert.equal(outcome.outcome, "cancelled");
      assert.match(outcome.detail, /was not sent/);
      const frames = await fixture.framesSince();
      assert.deepEqual(frames.map((frame) => frame.name), ["paste_begin", "paste_abort"], "BEGIN then a best-effort ABORT, no COMMIT");
      assert.equal(frames[1].operationId, 1);
      await fixture.assertComplete();
    });

    // (p8) Unknown delivery: committed, then the stream is lost before its result.
    await runScenario("p8-unknown-after-loss", async () => {
      const fixture = await attachPlane("p8");
      const pending = fixture.plane.writePaste("lost\n");
      await waitFrameCount(fixture, 3, "p8: commit before loss");
      fixture.control.close();
      const outcome = await pending;
      assert.equal(outcome.outcome, "outcome_unknown");
      assert.match(outcome.detail, /lost/);
      assert.equal(outcome.operationId, 1);
      await fixture.assertComplete();
    });

    // (p9) A later attachment restarts operation ids at 1 and never replays the lost paste.
    await runScenario("p9-fresh-attachment", async () => {
      const fixture = await attachPlane("p9");
      const lost = fixture.plane.writePaste("lost\n");
      await waitFrameCount(fixture, 3, "p9: commit before channel loss");
      fixture.terminal.close();
      assert.equal((await lost).outcome, "outcome_unknown");
      const second = await fixture.admit(1);
      assert.equal((await second.framesSince()).length, 0, "nothing from the lost operation on the replacement stream");
      const later = fixture.plane.writePaste("later\n");
      const frames = await waitFrameCount(second, 3, "p9: later commit");
      assert.deepEqual(frames.map((frame) => frame.name), ["paste_begin", "paste_chunk", "paste_commit"]);
      assert.equal(frames[0].operationId, 1, "operation ids restart on the new attachment");
      await second.result(1, "written", { accepted: 6, written: 6 });
      assert.equal((await later).outcome, "written");
      await fixture.assertComplete();
      await second.assertComplete();
    });

    // (p11) Queue capacity is reserved at admission: a paste behind a full in-flight window
    // and a full queue is refused at once, retains nothing, and later keys keep their order.
    await runScenario("p11-queue-items", async () => {
      const fixture = await attachPlane("p11");
      const noMods = { shift: false, ctrl: false, alt: false, super: false, capsLock: false, numLock: false };
      const key = (text) => fixture.plane.sendInput({ kind: "key", action: "press", code: "KeyK", key: text, mods: noMods, text, composing: false, unshiftedCodepoint: 107 });
      const total = MAX_INFLIGHT_INPUT_OPERATIONS + MAX_QUEUED_INPUT_OPERATIONS;
      for (let index = 0; index < total; index += 1) key("k");
      await waitFrameCount(fixture, MAX_INFLIGHT_INPUT_OPERATIONS, "p11: window full");
      const refused = await fixture.plane.writePaste("over\n");
      assert.equal(refused.outcome, "rejected_locally");
      assert.equal(refused.reason, "queue_bounds");
      assert.equal(refused.requestedBytes, 5);
      assert.match(refused.detail, new RegExp(`${MAX_QUEUED_INPUT_OPERATIONS} are queued`));
      const refusedKeys = fixture.outcomes.filter((outcome) => outcome.kind === "key" && outcome.reason === "queue_bounds");
      assert.equal(refusedKeys.length, 0, "the keys filled the bounds exactly");
      key("z");
      // The refused paste published its own queue_bounds outcome; the key adds exactly one more.
      assert.equal(fixture.outcomes.filter((outcome) => outcome.kind === "key" && outcome.reason === "queue_bounds").length, 1, "a key past the item bound is refused too");
      // Draining one in-flight result releases exactly one slot; the next paste is admitted
      // behind the remaining queued keys and is sent in order after them.
      await fixture.result(1, "written", { accepted: 13, written: 1 });
      // The result is processed on the plane's event queue; wait until the freed slot has
      // pumped the next queued key before admitting the late paste behind the queue.
      await waitFrameCount(fixture, MAX_INFLIGHT_INPUT_OPERATIONS + 1, "p11: freed slot pumped the next key");
      const admitted = fixture.plane.writePaste("late\n");
      for (let id = 2; id <= total; id += 1) {
        await waitCondition(async () => (await fixture.framesSince()).length >= Math.min(total, id + MAX_INFLIGHT_INPUT_OPERATIONS - 1), `p11: drain ${id}`);
        await fixture.result(id, "written", { accepted: 13, written: 1 });
      }
      const frames = await waitFrameCount(fixture, total + 3, "p11: late paste after the queue drained");
      assert.deepEqual(frames.slice(total).map((frame) => [frame.name, frame.operationId]), [
        ["paste_begin", total + 1], ["paste_chunk", total + 1], ["paste_commit", total + 1]
      ]);
      await fixture.result(total + 1, "written", { accepted: 5, written: 5 });
      assert.equal((await admitted).outcome, "written");
      await fixture.assertComplete();
    });

    // (p12) A paste queued behind a full window is fenced by its attachment: loss cancels it
    // unsent, in-flight keys end unknown, and the replacement attachment replays nothing.
    await runScenario("p12-queued-paste-loss", async () => {
      const fixture = await attachPlane("p12");
      const noMods = { shift: false, ctrl: false, alt: false, super: false, capsLock: false, numLock: false };
      for (let index = 0; index < MAX_INFLIGHT_INPUT_OPERATIONS; index += 1) {
        fixture.plane.sendInput({ kind: "key", action: "press", code: "KeyK", key: "k", mods: noMods, text: "k", composing: false, unshiftedCodepoint: 107 });
      }
      await waitFrameCount(fixture, MAX_INFLIGHT_INPUT_OPERATIONS, "p12: window full");
      const queued = fixture.plane.writePaste("queued\n");
      fixture.plane.sendInput({ kind: "key", action: "press", code: "KeyZ", key: "z", mods: noMods, text: "z", composing: false, unshiftedCodepoint: 122 });
      await flushMicrotasks();
      assert.equal((await fixture.framesSince()).length, MAX_INFLIGHT_INPUT_OPERATIONS, "the paste and the later key wait in the queue");
      fixture.terminal.close();
      const outcome = await queued;
      assert.equal(outcome.outcome, "cancelled");
      assert.equal(outcome.operationId, undefined, "an unsent paste never took an operation id");
      const unknownKeys = fixture.outcomes.filter((entry) => entry.kind === "key" && entry.outcome === "outcome_unknown").length;
      const cancelledKeys = fixture.outcomes.filter((entry) => entry.kind === "key" && entry.outcome === "cancelled").length;
      assert.deepEqual([unknownKeys, cancelledKeys], [MAX_INFLIGHT_INPUT_OPERATIONS, 1]);
      const second = await fixture.admit(1);
      await flushMicrotasks();
      assert.equal((await second.framesSince()).length, 0, "nothing from the lost attachment is replayed");
      await fixture.assertComplete();
      await second.assertComplete();
    });

    // (p13) Raw terminal messages queued ahead of decode are bounded: the bound acts on the
    // message event itself, so the channel closes before any queued handler runs.
    await runScenario("p13-inbound-admission", async () => {
      const fixture = await attachPlane("p13");
      const pending = fixture.plane.writePaste("pending\n");
      await waitFrameCount(fixture, 3, "p13: commit before the flood");
      const raw = new Uint8Array(64);
      for (let index = 0; index < localWebrtcInboundAdmissionLimits.maximumQueuedFrames; index += 1) fixture.terminal.emitMessage(raw.buffer);
      assert.equal(fixture.terminal.readyState, "open", "messages up to the frame bound are admitted");
      fixture.terminal.emitMessage(raw.buffer);
      assert.equal(fixture.terminal.readyState, "closed", "the frame past the bound retires the route synchronously");
      const outcome = await pending;
      assert.equal(outcome.outcome, "outcome_unknown");
      await fixture.assertComplete();
    });

    // (p14) Consent transfers one near-limit payload through the existing byte budget.
    // Confirmation creates a fresh operation and changes only the existing allow_unsafe field.
    await runScenario("p14-unsafe-consent-confirm", async () => {
      const fixture = await attachPlane("p14");
      const text = `${"u".repeat(MAX_PASTE_BYTES - 1)}\n`;
      const frameCount = Math.ceil(MAX_PASTE_BYTES / MAX_PASTE_CHUNK_DATA_BYTES) + 2;
      const pending = fixture.plane.writePaste(text);
      await waitFrameCount(fixture, frameCount, "p14: unconfirmed commit");
      assert.equal(fixture.plane.retainedInputBytes(), MAX_PASTE_BYTES, "unconfirmed in-flight bytes are charged once");
      assert.equal(fixture.plane.inflightInputBytes, MAX_PASTE_BYTES);
      assert.equal(fixture.plane.consentRetainedBytes, 0);

      await fixture.result(1, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const rejected = await pending;
      assert.ok(rejected.unsafePasteConsent, "an exact zero-write unsafe rejection offers consent");
      assert.equal(rejected.unsafePasteConsent.rejectedOperationId, 1);
      assert.equal(fixture.plane.retainedInputBytes(), MAX_PASTE_BYTES, "the in-flight charge transfers to consent");
      assert.equal(fixture.plane.inflightInputBytes, 0);
      assert.equal(fixture.plane.consentRetainedBytes, MAX_PASTE_BYTES);

      assert.equal(fixture.plane.confirmUnsafePaste(rejected.unsafePasteConsent), true);
      assert.equal(fixture.plane.confirmUnsafePaste(rejected.unsafePasteConsent), false, "consent is single-use");
      assert.equal(fixture.plane.consentRetainedBytes, 0, "confirmation releases the consent charge before queue admission");
      assert.equal(fixture.plane.retainedInputBytes(), MAX_PASTE_BYTES, "the confirmed queue or in-flight entry holds one charge");
      const frames = await waitFrameCount(fixture, 2 * frameCount, "p14: confirmed commit");
      const confirmed = frames.slice(frameCount);
      assert.deepEqual(new Set(confirmed.map((frame) => frame.operationId)), new Set([2]), "confirmation uses one new operation id");
      assert.equal(beginHeader(confirmed[0].body).allowUnsafe, true);
      assert.equal(new TextDecoder().decode(Buffer.concat(confirmed.slice(1, -1).map((frame) => chunkBody(frame.body).data))), text);
      await fixture.result(2, "written", { accepted: MAX_PASTE_BYTES, written: MAX_PASTE_BYTES });
      await waitCondition(() => fixture.outcomes.some((outcome) => outcome.operationId === 2 && outcome.outcome === "written"), "p14: confirmed result");
      assert.equal(fixture.plane.retainedInputBytes(), 0, "the written result releases the confirmed charge");
      await fixture.assertComplete();
    });

    // (p15) Only the newest paste attempt can create consent. Exact attachment identity
    // prevents an old prompt from approving new content after operation ids restart.
    await runScenario("p15-unsafe-consent-stale", async () => {
      const fixture = await attachPlane("p15");
      const first = fixture.plane.writePaste("first\n");
      const second = fixture.plane.writePaste("second\n");
      await waitFrameCount(fixture, 6, "p15: two paste commits");
      await fixture.result(1, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const firstOutcome = await first;
      assert.equal(firstOutcome.unsafePasteConsent, undefined, "an older out-of-order result cannot create consent");
      assert.equal(fixture.plane.consentRetainedBytes, 0);
      assert.equal(fixture.plane.retainedInputBytes(), 7, "only the newer in-flight payload remains charged");

      await fixture.result(2, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const secondOutcome = await second;
      const oldConsent = secondOutcome.unsafePasteConsent;
      assert.ok(oldConsent);
      assert.equal(fixture.plane.consentRetainedBytes, 7);

      const empty = await fixture.plane.writePaste("");
      assert.equal(empty.reason, "empty");
      assert.equal(fixture.plane.retainedInputBytes(), 0, "a new local rejection invalidates existing consent");
      assert.equal(fixture.plane.confirmUnsafePaste(oldConsent), false);

      const beforeLoss = fixture.plane.writePaste("before-loss\n");
      await waitFrameCount(fixture, 9, "p15: pre-loss paste commit");
      await fixture.result(3, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const beforeLossConsent = (await beforeLoss).unsafePasteConsent;
      assert.ok(beforeLossConsent);
      fixture.terminal.close();
      const replacement = await fixture.admit(1);
      assert.equal(fixture.plane.retainedInputBytes(), 0, "generation replacement releases consent");

      const replacementPaste = fixture.plane.writePaste("replacement\n");
      const replacementFrames = await waitFrameCount(replacement, 3, "p15: replacement paste commit");
      assert.equal(replacementFrames[0].operationId, 1, "the replacement generation reuses operation id 1");
      await replacement.result(1, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const replacementConsent = (await replacementPaste).unsafePasteConsent;
      assert.ok(replacementConsent);
      assert.notEqual(replacementConsent.attachmentGeneration, beforeLossConsent.attachmentGeneration);
      assert.equal(fixture.plane.confirmUnsafePaste(beforeLossConsent), false, "an old generation token sends nothing");
      assert.equal((await replacement.framesSince()).length, 3);
      assert.equal(fixture.plane.confirmUnsafePaste(replacementConsent), true);
      const confirmed = await waitFrameCount(replacement, 6, "p15: replacement confirmation");
      assert.equal(confirmed[3].operationId, 2);
      assert.equal(beginHeader(confirmed[3].body).allowUnsafe, true);
      await replacement.result(2, "written", { accepted: 12, written: 12 });
      await waitCondition(() => fixture.outcomes.some((outcome) => outcome.operationId === 2 && outcome.outcome === "written"), "p15: replacement result");
      await fixture.assertComplete();
      await replacement.assertComplete();
    });

    // (p16) Cancel, expiry, and route resync release only the pending consent. Missing
    // progress counts never create consent. Ordinary input remains usable after cancellation.
    await runScenario("p16-unsafe-consent-release", async () => {
      const fixture = await attachPlane("p16");
      const missing = fixture.plane.writePaste("missing\n");
      await waitFrameCount(fixture, 3, "p16: missing-count paste");
      await fixture.result(1, "rejected_unsafe_paste");
      assert.equal((await missing).unsafePasteConsent, undefined, "missing counts are not zero");
      assert.equal(fixture.plane.retainedInputBytes(), 0);

      const cancelled = fixture.plane.writePaste("cancel\n");
      await waitFrameCount(fixture, 6, "p16: cancelled paste");
      await fixture.result(2, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const cancelConsent = (await cancelled).unsafePasteConsent;
      assert.ok(cancelConsent);
      assert.equal(fixture.plane.cancelUnsafePaste(cancelConsent), true);
      assert.equal(fixture.plane.cancelUnsafePaste(cancelConsent), false);
      assert.equal(fixture.plane.retainedInputBytes(), 0);
      assert.equal((await fixture.framesSince()).length, 6, "cancel sends no paste frames");

      const noMods = { shift: false, ctrl: false, alt: false, super: false, capsLock: false, numLock: false };
      fixture.plane.sendInput({ kind: "key", action: "press", code: "KeyK", key: "k", mods: noMods, text: "k", composing: false, unshiftedCodepoint: 107 });
      await waitFrameCount(fixture, 7, "p16: ordinary key after cancel");
      await fixture.result(3, "written", { accepted: 13, written: 1 });

      const resynced = fixture.plane.writePaste("resync\n");
      await waitFrameCount(fixture, 10, "p16: resync paste");
      await fixture.result(4, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const resyncConsent = (await resynced).unsafePasteConsent;
      assert.ok(resyncConsent);
      await emitTestTerminalBody(
        fixture.terminal,
        secret,
        { generation: 9200, streamEpoch: 1 },
        terminalProtocolModule.encodeTerminalBody({ kind: "route_resync", from_epoch: 0, to_epoch: 1 })
      );
      await waitCondition(() => fixture.plane.consentRetainedBytes === 0, "p16: route resync release");
      assert.equal(fixture.plane.confirmUnsafePaste(resyncConsent), false);
      assert.equal(fixture.plane.inflightInputBytes, 0, "resync does not alter settled input accounting");
      await fixture.assertComplete();

      // The consent window is a controlled timer: captured by its distinctive test-hook delay and
      // fired explicitly, so the expiry is an event the test drives, not a wall-clock wait.
      const consentWindowMs = 7_777;
      const consentTimers = [];
      const globalSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (callback, delay, ...args) => {
        if (delay === consentWindowMs) {
          consentTimers.push(callback);
          return globalSetTimeout(() => undefined, 0);
        }
        return globalSetTimeout(callback, delay, ...args);
      };
      let expiryFixture;
      let expiredConsent;
      try {
        expiryFixture = await attachPlane("p16-expiry", { testHooks: { unsafePasteConsentTimeoutMs: consentWindowMs } });
        const expired = expiryFixture.plane.writePaste("expire\n");
        await waitFrameCount(expiryFixture, 3, "p16: expiring paste");
        await expiryFixture.result(1, "rejected_unsafe_paste", { accepted: 0, written: 0 });
        expiredConsent = (await expired).unsafePasteConsent;
      } finally {
        globalThis.setTimeout = globalSetTimeout;
      }
      assert.ok(expiredConsent);
      assert.equal(consentTimers.length, 1, "p16: exactly one consent window timer");
      assert.ok(expiryFixture.plane.consentRetainedBytes > 0, "p16: consent retained before expiry");
      consentTimers[0]();
      assert.equal(expiryFixture.plane.consentRetainedBytes, 0, "p16: consent expiry releases the retained bytes");
      assert.equal(expiryFixture.plane.retainedInputBytes(), 0);
      assert.equal(expiryFixture.plane.confirmUnsafePaste(expiredConsent), false);
      await expiryFixture.assertComplete();
    });

    // (p17) Nonzero progress is never eligible. Public detach releases an eligible payload
    // immediately and leaves its old token inert.
    await runScenario("p17-unsafe-consent-detach", async () => {
      const fixture = await attachPlane("p17");
      const nonzero = fixture.plane.writePaste("nonzero\n");
      await waitFrameCount(fixture, 3, "p17: nonzero unsafe result");
      await fixture.result(1, "rejected_unsafe_paste", { accepted: 0, written: 1 });
      assert.equal((await nonzero).unsafePasteConsent, undefined);
      assert.equal(fixture.plane.retainedInputBytes(), 0);

      const pending = fixture.plane.writePaste("detach\n");
      await waitFrameCount(fixture, 6, "p17: detachable consent");
      await fixture.result(2, "rejected_unsafe_paste", { accepted: 0, written: 0 });
      const consent = (await pending).unsafePasteConsent;
      assert.ok(consent);
      assert.equal(fixture.plane.consentRetainedBytes, 7);
      let detached = false;
      const detaching = fixture.plane.detach().then(() => { detached = true; notifyTestProgress(); });
      await waitCondition(async () => {
        await fixture.answerControl();
        return detached;
      }, "p17: detach response");
      await detaching;
      assert.equal(fixture.plane.retainedInputBytes(), 0, "detach releases consent accounting");
      assert.equal(fixture.plane.confirmUnsafePaste(consent), false);
      await fixture.assertComplete();
    });

    // (p10) Transport without a data plane: explicit local rejection, no key path.
    await runScenario("p10-unattached", async () => {
      const records = recorder();
      const uncaptured = recorder();
      const transport = new BotsterTerminalPtyTransport({
        record: (kind, payload) => records.push({ kind, payload }),
        onUncapturedInput: (source, data) => uncaptured.push({ source, data })
      });
      const none = await transport.writePaste("no-plane\n");
      assert.equal(none.outcome, "rejected_locally");
      assert.equal(none.reason, "no_data_plane");
      assert.deepEqual(uncaptured, [], "an unattached paste never falls back to the key path");
      assert.ok(records.some((entry) => entry.kind === "paste_unsupported"));
      transport.destroy();
    });
  } finally {
    // No window timers are substituted by this suite.
  }
}
