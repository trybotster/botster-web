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
  const { MAX_QUEUED_INPUT_BYTES } = requireRuntime("./botster/hubTerminalDataPlane.js");
  const { BotsterTerminalPtyTransport } = requireRuntime("./botster/botsterTerminalPtyTransport.js");

  const realSetTimeout = setTimeout;
  const realClearTimeout = clearTimeout;
  const SCENARIO_BOUND_MS = 20_000;
  for (const [name, value] of Object.entries({ MAX_PASTE_BYTES, MAX_PASTE_CHUNK_DATA_BYTES, MAX_QUEUED_INPUT_BYTES })) {
    assert.ok(Number.isInteger(value) && value > 0, `${name} must be a finite positive integer, observed ${String(value)}`);
  }
  let currentStage = "start";
  const stage = (label) => { currentStage = label; };
  const scenarioFixtures = [];
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
    for (let round = 0; round < 400; round += 1) {
      if (await predicate()) return;
      await new Promise((resolve) => realSetTimeout(resolve, 5));
    }
    assert.fail(`${label} did not complete within 2 s`);
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
  const attachPlane = async (name, { modeBits = ModeBits.CURSOR_VISIBLE, autoAckTerminal = true } = {}) => {
    const channels = [];
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
    const statuses = [];
    const outputs = [];
    const outcomes = [];
    const plane = createHubTerminalDataPlane({ sessionId, bridge: client });
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
          await emitChunkedTestResponse(control, secret, {
            kind: "terminal_reservation",
            terminal_reservation: {
              session_id: sessionId,
              subscription_id: request.subscription_id,
              generation,
              peer_generation: 1,
              label: `r-${name}-${request.subscription_id}`,
              expires_in_seconds: 30
            },
            events: []
          }, { messageId: `${name}-reservation-${index}`, requestType: "attach" });
        } else if (request?.type === "detach") {
          answered.add(index);
          await emitChunkedTestResponse(control, secret, { kind: "events", events: [] }, { messageId: `${name}-detach-${index}`, requestType: "detach" });
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
        const frames = await sentTestInputFrames({ sent: terminal.sent.slice(sentBefore) }, secret);
        return frames.map(decodeFrame);
      };
      return { terminal, subscriptionId, result, framesSince };
    };
    const first = await admit(0);
    return { client, control, plane, statuses, outputs, outcomes, sessionId, answerControl, admit, ...first };
  };
  const waitFrameCount = async (fixture, count, label) => {
    let frames = [];
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
    });

    // (p3) Bracketed paste on and off: byte-identical frames; the worker adds the markers.
    await runScenario("p3-bracketed-modes", async () => {
      const text = "bracket-me\n";
      const collected = [];
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
        if (expected.writtenPtyBytes !== undefined) assert.equal(outcome.writtenPtyBytes, expected.writtenPtyBytes, outcomeName);
        else assert.equal(outcome.writtenPtyBytes, undefined, `${outcomeName}: unknown counts are absent, never zero`);
        assert.match(outcome.detail, expected.detail, outcomeName);
        await flushMicrotasks();
        assert.equal((await fixture.framesSince()).length, expectedFrames, `${outcomeName}: no retry frames`);
      }
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

      // One assembling paste per route: the second waits until the first has its result.
      const firstPaste = fixture.plane.writePaste("first\n");
      const secondPaste = fixture.plane.writePaste("second\n");
      await waitFrameCount(fixture, 3, "p5: first paste commit");
      await flushMicrotasks();
      assert.equal((await fixture.framesSince()).length, 3, "the second paste is not assembling yet");
      await fixture.result(1, "written", { accepted: 6, written: 6 });
      assert.equal((await firstPaste).outcome, "written");
      const secondFrames = await waitFrameCount(fixture, 6, "p5: second paste commit");
      assert.equal(secondFrames[3].operationId, 2);
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
    });

    // (p6) Ordering: keys keep their place around a paste; a resize goes ahead of queued
    // operations but never lands inside BEGIN..COMMIT; every id increases in send order.
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
      // A resize that arrives while a later paste is queued is sent ahead of it.
      const laterPaste = fixture.plane.writePaste("later\n");
      fixture.plane.resize({ rows: 31, cols: 101, widthPx: 1010, heightPx: 620 });
      const later = await waitFrameCount(fixture, 10, "p6: later paste and resize");
      assert.deepEqual(later.slice(6).map((frame) => frame.name), ["paste_begin", "paste_chunk", "paste_commit", "resize"]);
      await fixture.result(5, "written", { accepted: 6, written: 6 });
      assert.equal((await laterPaste).outcome, "written");
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
    });

    // (p10) Transport without a data plane: explicit local rejection, no key path.
    await runScenario("p10-unattached", async () => {
      const records = [];
      const uncaptured = [];
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
