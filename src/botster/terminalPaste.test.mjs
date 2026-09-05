// Clipboard paste through HubTerminalDataPlane over the real WebrtcDaemonTransport.
//
// Each scenario attaches a real HubTerminalDataPlane to a real WebrtcDaemonTransport with
// fake peers, completes the actual terminal admission (reservation, reserved-channel Hello,
// snapshot READY and FINISH, Attached), then calls writePaste and decodes the exact
// terminal-protocol frames the plane sent on the reserved channel. Results are delivered
// as real input_result frames. Web never adds bracketed-paste markers; frames under
// bracketed_paste on and off are byte-identical.
//
// Named bounded scenarios on the real Node timer report the awaited stage on timeout.

import { strict as assert } from "node:assert";

export async function runTerminalPasteTests(helpers) {
  const {
    createFakeDataChannel,
    createFakePeerConnection,
    installAutoHelloAck,
    decryptTestEnvelope,
    decryptTestEnvelopeBytes,
    emitChunkedTestResponse,
    waitForTestCondition,
    flushMicrotasks,
    localWebrtcBootstrapFixture,
    createWebrtcDaemonClient,
    createHubTerminalDataPlane,
    bindGhostsnpInstaller,
    ghostsnpFixturePayloadBase64,
    ghostsnpFixtureBytes,
    testModeFlags,
    terminalProtocolModule,
    requireRuntime
  } = helpers;
  const secret = localWebrtcBootstrapFixture.grant_secret;
  const {
    MAX_PASTE_BYTES,
    MAX_PASTE_CHUNK_DATA_BYTES,
    encodePaste
  } = terminalProtocolModule;
  const { MAX_QUEUED_PASTE_BYTES, MAX_QUEUED_PASTE_OPERATIONS, PASTE_RESULT_BOUND_MS } =
    requireRuntime("./botster/hubTerminalDataPlane.js");
  const { BotsterTerminalPtyTransport } = requireRuntime("./botster/botsterTerminalPtyTransport.js");

  const realSetTimeout = setTimeout;
  const realClearTimeout = clearTimeout;
  const SCENARIO_BOUND_MS = 20_000;
  let currentStage = "start";
  const stage = (label) => { currentStage = label; };
  const runScenario = async (name, body) => {
    currentStage = "start";
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
    }
  };
  const waitCondition = async (predicate, label) => {
    stage(label ?? `waitCondition ${predicate.toString().replace(/\s+/g, " ")}`);
    await waitForTestCondition(predicate);
  };

  // Controlled window timers for the result bound only; every other wait uses real timers.
  const originalSetTimeout = globalThis.window.setTimeout;
  const originalClearTimeout = globalThis.window.clearTimeout;
  const timers = new Map();
  let nextTimer = 0;
  globalThis.window.setTimeout = (callback, delay) => {
    const timer = ++nextTimer;
    timers.set(timer, { callback, delay });
    return timer;
  };
  globalThis.window.clearTimeout = (timer) => timers.delete(timer);
  const fireResultBound = () => {
    const entries = [...timers.entries()].filter(([, entry]) => entry.delay === PASTE_RESULT_BOUND_MS);
    assert.equal(entries.length, 1, "exactly one live paste result bound timer");
    timers.delete(entries[0][0]);
    entries[0][1].callback();
  };

  // Decode every terminal-protocol frame the plane sent on a reserved channel, in order.
  // Decoded frames are memoized per message id so repeated polls do not re-decrypt.
  const decodedFrames = new Map();
  const decodeSentFrames = async (channel) => {
    const chunksByMessage = new Map();
    for (const raw of channel.sent) {
      const chunk = JSON.parse(raw);
      const list = chunksByMessage.get(chunk.message_id) ?? [];
      list.push(chunk);
      chunksByMessage.set(chunk.message_id, list);
    }
    const frames = [];
    for (const [messageId, chunks] of chunksByMessage.entries()) {
      chunks.sort((a, b) => a.chunk_index - b.chunk_index);
      if (chunks.length !== chunks[0].chunk_count) continue;
      const cacheKey = `${channel.label ?? ""}:${messageId}`;
      let frame = decodedFrames.get(cacheKey);
      if (!frame) {
        const bytes = await decryptTestEnvelopeBytes(secret, chunks.map((chunk) => chunk.payload).join(""));
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const body = bytes.subarray(4, 4 + view.getUint16(2, false));
        frame = { kind: bytes[1], body, bytes };
        decodedFrames.set(cacheKey, frame);
      }
      frames.push(frame);
    }
    return frames;
  };
  const kindName = (kind) => ({ 1: "input", 2: "mode_gated", 3: "resize", 4: "begin", 5: "chunk", 6: "commit", 7: "abort" })[kind] ?? String(kind);
  const beginHeader = (body) => {
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    return {
      operationId: view.getUint32(0, false),
      modeGeneration: Number(view.getBigUint64(4, false)),
      modeRevision: Number(view.getBigUint64(12, false)),
      totalLength: view.getUint32(20, false)
    };
  };
  const chunkBody = (body) => {
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    return { operationId: view.getUint32(0, false), index: view.getUint32(4, false), data: body.subarray(8) };
  };

  /**
   * One attached plane over a real transport. `modeOverrides` shape the read_mode_flags
   * answer (bracketed_paste, tokens). Control read requests are answered as they arrive.
   */
  const attachPlane = async (name, { modeOverrides = {}, autoAckTerminal = true } = {}) => {
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
    const statuses = [];
    const outputs = [];
    const plane = createHubTerminalDataPlane({ sessionId, bridge: client });
    bindGhostsnpInstaller(plane);
    plane.subscribeStatus((status) => statuses.push(status));
    plane.subscribeOutput((data) => outputs.push(data));
    await waitCondition(() => channels.length === 1 && channels[0].sent.length >= 1, `${name}: attach request`);
    const control = channels[0];
    const answered = new Set();
    const modeFlags = testModeFlags(sessionId, modeOverrides);
    const answerControlReads = async () => {
      for (const [index, sent] of control.sent.entries()) {
        if (answered.has(index)) continue;
        let request;
        try {
          request = await decryptTestEnvelope(secret, sent);
        } catch {
          continue;
        }
        if (request.type === "read_mode_flags") {
          answered.add(index);
          await emitChunkedTestResponse(control, secret,
            { kind: "read_mode_flags", mode_flags: { ...modeFlags }, events: [] },
            { messageId: `${name}-mode-flags-${index}` });
        } else if (request.type === "read_screen") {
          answered.add(index);
          await emitChunkedTestResponse(control, secret,
            { kind: "read_screen", read_screen: { session_id: sessionId, text: "" }, events: [] },
            { messageId: `${name}-read-screen-${index}` });
        } else if (request.type === "attach") {
          answered.add(index);
          await emitChunkedTestResponse(control, secret, {
            kind: "terminal_reservation",
            terminal_reservation: {
              session_id: sessionId,
              subscription_id: request.subscription_id,
              generation: 9200,
              peer_generation: 1,
              label: `r-${name}`,
              expires_in_seconds: 30
            },
            events: []
          }, { messageId: `${name}-reservation` });
        }
      }
    };
    await answerControlReads();
    await waitCondition(
      () => control.createdDataChannels.some((channel) => channel.label === `r-${name}` && channel.helloAckDelivered === true),
      `${name}: reserved channel Hello`
    );
    const terminal = control.createdDataChannels.find((channel) => channel.label === `r-${name}`);
    const attach = (await Promise.all(control.sent.map((sent) => decryptTestEnvelope(secret, sent).catch(() => null))))
      .find((request) => request?.type === "attach");
    const subscriptionId = attach.subscription_id;
    const terminalFrame = (frame, messageId) => emitChunkedTestResponse(terminal, secret, {
      session_id: sessionId,
      subscription_id: subscriptionId,
      ...frame
    }, { messageId, deliveryKind: "daemon_terminal_frame" });
    const snapshot = { type: "snapshot", payload_base64: ghostsnpFixturePayloadBase64, payload_encoding: "base64", bytes: ghostsnpFixtureBytes };
    await terminalFrame(snapshot, `${name}-snapshot-ready`);
    await terminalFrame(snapshot, `${name}-snapshot-finish`);
    await terminalFrame({ type: "attach_state", state: "attached" }, `${name}-attached`);
    for (let round = 0; round < 40 && !statuses.some((status) => status.state === "attached"); round += 1) {
      await answerControlReads();
      await new Promise((resolve) => realSetTimeout(resolve, 0));
    }
    assert.ok(statuses.some((status) => status.state === "attached"), `${name}: plane reached Attached`);
    const sentBefore = terminal.sent.length;
    const inputResult = (result, messageId) => terminalFrame({
      type: "input_result",
      subscription_id: subscriptionId,
      mode_generation: modeFlags.mode_generation,
      mode_revision: modeFlags.mode_revision,
      mode_flags: {
        kitty_enabled: modeFlags.kitty_enabled,
        cursor_visible: modeFlags.cursor_visible,
        bracketed_paste: modeFlags.bracketed_paste,
        mouse_mode: modeFlags.mouse_mode,
        alt_screen: modeFlags.alt_screen,
        focus_reporting: modeFlags.focus_reporting,
        application_cursor: modeFlags.application_cursor
      },
      ...result
    }, messageId);
    const framesSince = async () => decodeSentFrames({ label: terminal.label, sent: terminal.sent.slice(sentBefore) });
    return { client, control, terminal, plane, statuses, outputs, modeFlags, subscriptionId, sessionId, answerControlReads, inputResult, framesSince, sentBefore };
  };
  // Frames decode asynchronously, so poll them on the real timer instead of waitForTestCondition.
  const waitFrameCount = async (fixture, count, label) => {
    stage(label);
    for (let round = 0; round < 60; round += 1) {
      const frames = await fixture.framesSince();
      if (frames.length >= count) return frames;
      await new Promise((resolve) => realSetTimeout(resolve, 5));
    }
    assert.fail(`${label}: expected at least ${count} frames`);
  };

  try {
    // (p1) 70,000-byte ASCII paste: exact frame sequence, header, chunk split, and commit.
    await runScenario("p1-large-ascii", async () => {
      const fixture = await attachPlane("p1");
      const text = `botster-paste:${"p".repeat(70_000 - 14)}`;
      assert.equal(new TextEncoder().encode(text).byteLength, 70_000);
      const pending = fixture.plane.writePaste(text);
      const frames = await waitFrameCount(fixture, 4, "p1: begin, two chunks, commit");
      assert.deepEqual(frames.map((frame) => kindName(frame.kind)), ["begin", "chunk", "chunk", "commit"]);
      const header = beginHeader(frames[0].body);
      assert.deepEqual(header, { operationId: 1, modeGeneration: 1, modeRevision: 1, totalLength: 70_000 });
      const first = chunkBody(frames[1].body);
      const second = chunkBody(frames[2].body);
      assert.equal(first.index, 0);
      assert.equal(second.index, 1);
      assert.equal(first.data.byteLength, MAX_PASTE_CHUNK_DATA_BYTES);
      assert.equal(second.data.byteLength, 70_000 - MAX_PASTE_CHUNK_DATA_BYTES);
      const received = new TextDecoder().decode(Buffer.concat([first.data, second.data]));
      assert.equal(received, text, "received content is byte-identical");
      // The frames equal the package encoder's output for the same inputs: Web adds nothing.
      const expected = encodePaste(1, 1, 1, new TextEncoder().encode(text));
      assert.deepEqual(frames.map((frame) => Buffer.from(frame.bytes)), expected.map((frame) => Buffer.from(frame)));
      await fixture.inputResult({ kind: "paste", operation_id: 1, admitted: true, bytes_written: 70_000 }, "p1-result");
      stage("p1: outcome");
      const outcome = await pending;
      assert.deepEqual({ kind: outcome.kind, outcome: outcome.outcome, bytes: outcome.bytes, operationId: outcome.operationId },
        { kind: "paste", outcome: "admitted", bytes: 70_000, operationId: 1 });
      fixture.client.disconnect();
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
      await fixture.inputResult({ kind: "paste", operation_id: 1, admitted: true, bytes_written: bytes }, "p2-result");
      const outcome = await pending;
      assert.equal(outcome.outcome, "admitted");
      assert.equal(outcome.bytes, bytes);
      fixture.client.disconnect();
    });

    // (p3) bracketed_paste on and off: byte-identical frames; Web never adds markers.
    await runScenario("p3-bracketed-modes", async () => {
      const text = "bracket-me\n";
      const collected = [];
      for (const bracketed of [false, true]) {
        const fixture = await attachPlane(`p3-${bracketed ? "on" : "off"}`, { modeOverrides: { bracketed_paste: bracketed } });
        const pending = fixture.plane.writePaste(text);
        const frames = await waitFrameCount(fixture, 3, `p3 ${bracketed}: frames`);
        collected.push(frames.map((frame) => Buffer.from(frame.bytes).toString("hex")).join("|"));
        const content = new TextDecoder().decode(chunkBody(frames[1].body).data);
        assert.equal(content, text);
        assert.equal(content.includes("\x1b[200~"), false, "no bracketed-paste opener from Web");
        await fixture.inputResult({ kind: "paste", operation_id: 1, admitted: true, bytes_written: text.length }, `p3-${bracketed}-result`);
        assert.equal((await pending).outcome, "admitted");
        fixture.client.disconnect();
      }
      assert.equal(collected[0], collected[1], "frames are identical under bracketed_paste off and on");
    });

    // (p4) stale_mode: one retry with a new operation id under the returned mode; then admitted.
    await runScenario("p4-stale-retry", async () => {
      const fixture = await attachPlane("p4");
      const text = "stale-once\n";
      const pending = fixture.plane.writePaste(text);
      await waitFrameCount(fixture, 3, "p4: first commit");
      await fixture.inputResult({
        kind: "paste", operation_id: 1, admitted: false, bytes_written: 0, rejection: "stale_mode",
        mode_generation: 2, mode_revision: 7
      }, "p4-stale");
      const frames = await waitFrameCount(fixture, 6, "p4: second commit");
      assert.deepEqual(frames.map((frame) => kindName(frame.kind)), ["begin", "chunk", "commit", "begin", "chunk", "commit"]);
      assert.deepEqual(beginHeader(frames[3].body), { operationId: 2, modeGeneration: 2, modeRevision: 7, totalLength: text.length });
      await fixture.inputResult({ kind: "paste", operation_id: 2, admitted: true, bytes_written: text.length, mode_generation: 2, mode_revision: 7 }, "p4-admitted");
      const outcome = await pending;
      assert.equal(outcome.outcome, "admitted");
      assert.equal(outcome.operationId, 2);
      // A second stale rejection is not retried again.
      const again = fixture.plane.writePaste(text);
      await waitFrameCount(fixture, 9, "p4: third commit");
      await fixture.inputResult({ kind: "paste", operation_id: 3, admitted: false, bytes_written: 0, rejection: "stale_mode", mode_generation: 3, mode_revision: 1 }, "p4-stale-2");
      await waitFrameCount(fixture, 12, "p4: fourth commit");
      await fixture.inputResult({ kind: "paste", operation_id: 4, admitted: false, bytes_written: 0, rejection: "stale_mode", mode_generation: 4, mode_revision: 1 }, "p4-stale-3");
      const rejected = await again;
      assert.equal(rejected.outcome, "rejected");
      assert.equal(rejected.reason, "stale_mode");
      assert.equal((await fixture.framesSince()).length, 12, "no third attempt");
      fixture.client.disconnect();
    });

    // (p5) Rejections that are never retried: operation_out_of_bounds, timeout, partial_write.
    await runScenario("p5-rejections", async () => {
      const fixture = await attachPlane("p5");
      let expectedFrames = 0;
      let operationId = 0;
      for (const [rejection, bytesWritten] of [["operation_out_of_bounds", 0], ["timeout", 0], ["partial_write", 3]]) {
        operationId += 1;
        const pending = fixture.plane.writePaste("reject-me\n");
        expectedFrames += 3;
        await waitFrameCount(fixture, expectedFrames, `p5 ${rejection}: commit`);
        await fixture.inputResult({ kind: "paste", operation_id: operationId, admitted: false, bytes_written: bytesWritten, rejection }, `p5-${rejection}`);
        const outcome = await pending;
        assert.equal(outcome.outcome, "rejected", rejection);
        assert.equal(outcome.reason, rejection);
        assert.match(outcome.detail, bytesWritten > 0 ? /after 3 bytes/ : /rejected by the terminal/);
        await flushMicrotasks();
        assert.equal((await fixture.framesSince()).length, expectedFrames, `${rejection}: no retry frames`);
      }
      fixture.client.disconnect();
    });

    // (p6) Bounds: per-paste size before encoding, queued operation count, and queued bytes.
    await runScenario("p6-bounds", async () => {
      const fixture = await attachPlane("p6");
      const tooLarge = await fixture.plane.writePaste("x".repeat(MAX_PASTE_BYTES + 1));
      assert.equal(tooLarge.outcome, "rejected");
      assert.equal(tooLarge.reason, "too_large");
      const empty = await fixture.plane.writePaste("");
      assert.equal(empty.reason, "empty");
      assert.equal((await fixture.framesSince()).length, 0, "no frames for refused pastes");
      // Fill the operation bound with unanswered pastes; the next one is refused immediately.
      const pendings = [];
      for (let index = 0; index < MAX_QUEUED_PASTE_OPERATIONS; index += 1) {
        pendings.push(fixture.plane.writePaste(`queued-${index}\n`));
      }
      const overflow = await fixture.plane.writePaste("one-too-many\n");
      assert.equal(overflow.outcome, "rejected");
      assert.equal(overflow.reason, "queue_bounds");
      await waitFrameCount(fixture, 3, "p6: first queued commit");
      // Settle the queue in order; each admitted outcome releases its counters.
      for (let index = 0; index < MAX_QUEUED_PASTE_OPERATIONS; index += 1) {
        await waitFrameCount(fixture, 3 * (index + 1), `p6: commit ${index + 1}`);
        await fixture.inputResult({ kind: "paste", operation_id: index + 1, admitted: true, bytes_written: `queued-${index}\n`.length }, `p6-admit-${index}`);
        assert.equal((await pendings[index]).outcome, "admitted");
      }
      // Byte bound: two 1 MiB pastes fit, a third does not while they are queued.
      const big = "b".repeat(MAX_PASTE_BYTES);
      const bigA = fixture.plane.writePaste(big);
      const bigB = fixture.plane.writePaste(big);
      const bigC = await fixture.plane.writePaste("c");
      assert.equal(bigC.reason, "queue_bounds");
      assert.equal(MAX_QUEUED_PASTE_BYTES, 2 * MAX_PASTE_BYTES);
      const bigFrames = Math.ceil(MAX_PASTE_BYTES / MAX_PASTE_CHUNK_DATA_BYTES) + 2;
      const baseline = 3 * MAX_QUEUED_PASTE_OPERATIONS;
      await waitFrameCount(fixture, baseline + bigFrames, "p6: big A commit");
      await fixture.inputResult({ kind: "paste", operation_id: MAX_QUEUED_PASTE_OPERATIONS + 1, admitted: true, bytes_written: MAX_PASTE_BYTES }, "p6-big-a");
      assert.equal((await bigA).outcome, "admitted");
      await waitFrameCount(fixture, baseline + 2 * bigFrames, "p6: big B commit");
      await fixture.inputResult({ kind: "paste", operation_id: MAX_QUEUED_PASTE_OPERATIONS + 2, admitted: true, bytes_written: MAX_PASTE_BYTES }, "p6-big-b");
      assert.equal((await bigB).outcome, "admitted");
      // Counters released: the next paste is queued (still pending), not refused.
      const afterPending = fixture.plane.writePaste("c");
      const raced = await Promise.race([afterPending, new Promise((resolve) => realSetTimeout(() => resolve("pending"), 50))]);
      assert.equal(raced, "pending", "paste after release is queued rather than refused");
      await waitFrameCount(fixture, baseline + 2 * bigFrames + 3, "p6: post-release commit");
      await fixture.inputResult({ kind: "paste", operation_id: MAX_QUEUED_PASTE_OPERATIONS + 3, admitted: true, bytes_written: 1 }, "p6-after");
      assert.equal((await afterPending).outcome, "admitted");
      fixture.client.disconnect();
    });

    // (p7) Ordering: keys do not overtake a paste, and no resize frame lands inside Begin..Commit.
    await runScenario("p7-ordering", async () => {
      const fixture = await attachPlane("p7");
      const key = (data) => fixture.plane.writeModeGatedInput({ encode: () => data });
      const first = key("a");
      const paste = fixture.plane.writePaste("PASTE\n");
      const second = key("b");
      await waitFrameCount(fixture, 1, "p7: first key frame");
      // The first key awaits its result before the paste starts; a resize arrives meanwhile.
      const resize = fixture.plane.resize(30, 100);
      await flushMicrotasks();
      await fixture.inputResult({ kind: "mode_gated_input", admitted: true, bytes_written: 1 }, "p7-key-a");
      await first;
      const frames = await waitFrameCount(fixture, 5, "p7: resize then paste frames");
      // Coalesced resize flushes before the next queued send, never between Begin and Commit.
      assert.deepEqual(frames.map((frame) => kindName(frame.kind)), ["mode_gated", "resize", "begin", "chunk", "commit"]);
      await fixture.inputResult({ kind: "paste", operation_id: 1, admitted: true, bytes_written: 6 }, "p7-paste");
      assert.equal((await paste).outcome, "admitted");
      const afterPaste = await waitFrameCount(fixture, 6, "p7: second key after paste");
      assert.equal(kindName(afterPaste[5].kind), "mode_gated");
      assert.equal(new TextDecoder().decode(afterPaste[5].body.subarray(16)), "b");
      await fixture.inputResult({ kind: "mode_gated_input", admitted: true, bytes_written: 1 }, "p7-key-b");
      await second;
      await resize;
      fixture.client.disconnect();
    });

    // (p8) Cancellation before Commit: a failing chunk send aborts on the live stream.
    await runScenario("p8-cancel-before-commit", async () => {
      const fixture = await attachPlane("p8");
      const originalSend = fixture.terminal.send.bind(fixture.terminal);
      let sends = 0;
      fixture.terminal.send = (data) => {
        sends += 1;
        // Chunks arrive as delivery chunks; fail the second protocol frame's first delivery.
        const chunk = JSON.parse(data);
        if (chunk.message_id.endsWith(":2") && chunk.chunk_index === 0) throw new Error("chunk send failed");
        originalSend(data);
      };
      const outcome = await fixture.plane.writePaste("cancel-me\n");
      assert.equal(outcome.outcome, "cancelled");
      assert.match(outcome.detail, /was not sent/);
      const frames = await fixture.framesSince();
      assert.deepEqual(frames.map((frame) => kindName(frame.kind)), ["begin", "abort"], "Begin then best-effort Abort, no Commit");
      assert.equal(beginHeader(frames[0].body).operationId, 1);
      assert.ok(sends >= 2);
      fixture.client.disconnect();
    });

    // (p9) Unknown delivery: committed, then the stream is lost; and committed, then the bound fires.
    await runScenario("p9-unknown-delivery", async () => {
      const lost = await attachPlane("p9-lost");
      const pendingLost = lost.plane.writePaste("lost\n");
      await waitFrameCount(lost, 3, "p9: commit before loss");
      lost.control.close();
      stage("p9: outcome after loss");
      const lostOutcome = await pendingLost;
      assert.equal(lostOutcome.outcome, "unknown");
      assert.match(lostOutcome.detail, /stream was lost/);
      lost.client.disconnect();

      const bound = await attachPlane("p9-bound");
      const pendingBound = bound.plane.writePaste("bound\n");
      await waitFrameCount(bound, 3, "p9: commit before bound");
      await flushMicrotasks();
      fireResultBound();
      const boundOutcome = await pendingBound;
      assert.equal(boundOutcome.outcome, "unknown");
      assert.match(boundOutcome.detail, /No paste result within/);
      // A late authoritative result after the bound changes nothing and settles cleanly.
      await bound.inputResult({ kind: "paste", operation_id: 1, admitted: true, bytes_written: 6 }, "p9-late");
      await flushMicrotasks();
      bound.client.disconnect();
    });

    // (p10) Transport without a paste owner: explicit unsupported rejection, no key path.
    await runScenario("p10-unsupported", async () => {
      const records = [];
      const transport = new BotsterTerminalPtyTransport({
        createModeDependentInput: (data) => ({ encode: () => data }),
        record: (kind, payload) => records.push({ kind, payload })
      });
      const none = await transport.writePaste("no-plane\n");
      assert.equal(none.outcome, "rejected");
      assert.equal(none.reason, "unsupported");
      const inputs = [];
      transport.attach({
        sessionId: "no-owner",
        writeInput: (data) => inputs.push(data),
        subscribeOutput: () => ({ unsubscribe() {} }),
        resize: () => undefined
      });
      const noOwner = await transport.writePaste("no-owner\n");
      assert.equal(noOwner.outcome, "rejected");
      assert.equal(noOwner.reason, "unsupported");
      assert.match(noOwner.detail, /does not support clipboard paste/);
      assert.deepEqual(inputs, [], "an unsupported paste never falls back to key input");
      assert.ok(records.some((entry) => entry.kind === "paste_unsupported"));
      transport.destroy();
    });
  } finally {
    globalThis.window.setTimeout = originalSetTimeout;
    globalThis.window.clearTimeout = originalClearTimeout;
  }
}
