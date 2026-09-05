// Resilient WebRTC reconnect over the real WebrtcDaemonTransport with fake peers and channels.
//
// Recovery scenarios (a), (a2), (b), (c), (e), (f) establish reconnect demand, close the live
// transport, fail at least one connection attempt, and recover WITHOUT a new caller request.
// Scenarios (d), (g), and (h) cover cancellation, lifecycle-callback boundaries, and the
// absolute attempt deadline. Timers go through the test window so retry delays and attempt
// deadlines are fired explicitly.
//
// Runs inside App.test.mjs while the test window object (lifecycle capture, timers) is active.

import { strict as assert } from "node:assert";

export async function runWebrtcReconnectTests(helpers) {
  const {
    createFakeDataChannel,
    createFakePeerConnection,
    installAutoHelloAck,
    decryptTestEnvelope,
    emitChunkedTestResponse,
    waitForTestCondition,
    flushMicrotasks,
    localWebrtcBootstrapFixture,
    lifecycleEvents,
    createWebrtcDaemonClient,
    createHubTerminalDataPlane,
    webRtcLifecycleDiagnostic,
    localWebrtcReconnectPolicy,
    bindGhostsnpInstaller,
    ghostsnpFixturePayloadBase64,
    ghostsnpFixtureBytes,
    testModeFlags
  } = helpers;
  const secret = localWebrtcBootstrapFixture.grant_secret;

  // Controlled window timers: every entry records its delay and the lifecycle event count at
  // creation so retry and deadline timers can be identified without guessing ids.
  const originalSetTimeout = globalThis.window.setTimeout;
  const originalClearTimeout = globalThis.window.clearTimeout;
  const timers = new Map();
  let nextTimer = 0;
  globalThis.window.setTimeout = (callback, delay) => {
    const timer = ++nextTimer;
    timers.set(timer, { callback, delay, eventIndex: lifecycleEvents.length });
    return timer;
  };
  globalThis.window.clearTimeout = (timer) => timers.delete(timer);
  // Explicit timer ownership: the client installs an attempt's deadline immediately before it
  // emits reconnect-attempt, and a retry timer immediately before it emits reconnect-scheduled.
  // Capture the most recently created timer at each of those emissions as the owned timer.
  const ownedTimers = new Map();
  const originalDispatch = globalThis.window.dispatchEvent;
  globalThis.window.dispatchEvent = (event) => {
    const type = event.detail?.type;
    if (type === "reconnect-attempt" || type === "reconnect-scheduled") {
      ownedTimers.set(lifecycleEvents.length, { type, timerId: nextTimer, delay: timers.get(nextTimer)?.delay });
    }
    return originalDispatch.call(globalThis.window, event);
  };
  const ownedTimerAt = (eventIndex, type) => {
    const owned = ownedTimers.get(eventIndex);
    assert.ok(owned && owned.type === type, `owned timer captured at ${type} event ${eventIndex}`);
    return owned;
  };

  const eventsSince = (index, type) =>
    lifecycleEvents.slice(index).map((event) => event.detail).filter((detail) => !type || detail.type === type);
  const lastEventIndexOf = (type) => {
    for (let index = lifecycleEvents.length - 1; index >= 0; index -= 1) {
      if (lifecycleEvents[index].detail.type === type) return index;
    }
    return -1;
  };
  const liveTimersWithDelay = (delay, createdAfterEventIndex = -1) =>
    [...timers.entries()].filter(([, entry]) => entry.delay === delay && entry.eventIndex > createdAfterEventIndex);
  const fireTimer = (id) => {
    const entry = timers.get(id);
    assert.ok(entry, `timer ${id} is live`);
    timers.delete(id);
    entry.callback();
  };
  // The retry timer is the timer owned by the latest reconnect-scheduled emission. It must also
  // be the only live timer with that delay created at that emission.
  const fireRetryTimer = async (expectedDelay) => {
    const scheduledIndex = lastEventIndexOf("reconnect-scheduled");
    assert.ok(scheduledIndex >= 0, "a reconnect-scheduled event exists");
    const scheduled = lifecycleEvents[scheduledIndex].detail;
    assert.equal(scheduled.delayMs, expectedDelay);
    const owned = ownedTimerAt(scheduledIndex, "reconnect-scheduled");
    assert.equal(owned.delay, expectedDelay, "the owned retry timer carries the scheduled delay");
    const candidates = liveTimersWithDelay(expectedDelay, scheduledIndex - 1);
    assert.equal(candidates.length, 1, `exactly one live retry timer with delay ${expectedDelay}`);
    assert.equal(candidates[0][0], owned.timerId, "the live retry timer is the owned one");
    fireTimer(owned.timerId);
    await flushMicrotasks();
  };
  // The attempt deadline is the timer owned by the latest reconnect-attempt emission. It must
  // also be the only live attemptTimeoutMs timer created at that emission.
  const fireDeadlineTimer = async () => {
    const attemptIndex = lastEventIndexOf("reconnect-attempt");
    assert.ok(attemptIndex >= 0, "a reconnect-attempt event exists");
    const owned = ownedTimerAt(attemptIndex, "reconnect-attempt");
    assert.equal(owned.delay, localWebrtcReconnectPolicy.attemptTimeoutMs, "the owned deadline carries attemptTimeoutMs");
    const candidates = liveTimersWithDelay(localWebrtcReconnectPolicy.attemptTimeoutMs, attemptIndex - 1)
      .filter(([, entry]) => entry.eventIndex === attemptIndex);
    assert.equal(candidates.length, 1, "exactly one live attempt deadline timer");
    assert.equal(candidates[0][0], owned.timerId, "the live deadline is the owned one");
    fireTimer(owned.timerId);
    await flushMicrotasks();
  };
  const deadlineCleared = () => {
    const attemptIndex = lastEventIndexOf("reconnect-attempt");
    const owned = ownedTimerAt(attemptIndex, "reconnect-attempt");
    return !timers.has(owned.timerId);
  };
  // Key import and peer creation are real async work, so attempt counts and scheduled events
  // are awaited as conditions rather than asserted after a microtask flush.
  const waitAttempts = async (attempts, expected) => {
    await waitForTestCondition(() => attempts() >= expected);
    assert.equal(attempts(), expected);
  };
  const waitScheduled = async (since, expected) => {
    await waitForTestCondition(() => eventsSince(since, "reconnect-scheduled").length >= expected);
    const scheduled = eventsSince(since, "reconnect-scheduled");
    assert.equal(scheduled.length, expected);
    return scheduled;
  };
  const decryptAll = async (channel) => {
    const requests = [];
    for (const sent of channel.sent) {
      try {
        requests.push(await decryptTestEnvelope(secret, sent));
      } catch {
        // Reserved-channel chunks are not request envelopes.
      }
    }
    return requests;
  };

  /**
   * Client whose peer factory fails for the attempt numbers in `failAttempts` (1-based
   * across the client's lifetime) and otherwise returns a fresh fake peer with auto Hello.
   */
  const makeClient = ({ failAttempts = new Set(), fetchImpl, refreshBootstrap, autoHello = true, blockAttempts = new Map(), onLifecycle } = {}) => {
    const channels = [];
    let attempts = 0;
    let signalCalls = 0;
    const client = createWebrtcDaemonClient({
      bootstrap: localWebrtcBootstrapFixture,
      ...(refreshBootstrap ? { refreshBootstrap } : {}),
      ...(onLifecycle ? { onLifecycle: (event) => onLifecycle(event, client) } : {}),
      peerConnectionFactory: () => {
        attempts += 1;
        if (failAttempts.has(attempts)) {
          throw new Error(`peer factory failure ${attempts}`);
        }
        const channel = createFakeDataChannel();
        channel.attempt = attempts;
        if (autoHello) installAutoHelloAck(channel, secret);
        channels.push(channel);
        return createFakePeerConnection(channel, secret);
      },
      fetchImpl: fetchImpl ?? (async () => {
        signalCalls += 1;
        const blocked = blockAttempts.get(signalCalls);
        if (blocked) return blocked;
        return {
          ok: true,
          json: async () => ({
            payload: { local_webrtc_answer: { grant_id: localWebrtcBootstrapFixture.grant_id, answer: { type: "answer", sdp: "answer-sdp" } } }
          })
        };
      })
    });
    return { client, channels, attempts: () => attempts };
  };

  // Peers are created after the bootstrap await, so wait for the channel before answering.
  // Readiness resolves only after the initial snapshot arrives on the reserved entity channel.
  const answerEntitySubscribe = async (channels, index, messageId) => {
    await waitForTestCondition(() => channels[index]?.sent.length >= 1);
    const subscribe = (await decryptAll(channels[index])).find((request) => request.type === "subscribe_entities");
    assert.ok(subscribe, `subscribe_entities on peer ${index}`);
    await emitChunkedTestResponse(channels[index], secret, { kind: "entity_subscribed", events: [], diagnostics: [] }, { messageId });
    await emitChunkedTestResponse(channels[index], secret, {
      type: "entity_snapshot", subscription_id: subscribe.subscription_id, entity_type: "session", snapshot_seq: 0, items: []
    }, { deliveryKind: "daemon_entity_frame", messageId: `${messageId}-snapshot` });
    return subscribe;
  };

  try {
    // (a) Held entity demand: two failed attempts, then recovery without any new request.
    {
      const before = lifecycleEvents.length;
      const { client, channels, attempts } = makeClient({ failAttempts: new Set([2, 3]) });
      const frames = [];
      const subscription = client.subscribeEntityFrames("session", (frame) => frames.push(frame));
      await answerEntitySubscribe(channels, 0, "reconnect-a-subscribe-1");
      await subscription.ready;
      await waitAttempts(attempts, 1);
      const firstSubscribe = (await decryptAll(channels[0])).find((request) => request.type === "subscribe_entities");
      assert.ok(firstSubscribe);

      channels[0].close();
      await flushMicrotasks();
      await flushMicrotasks();
      // Immediate recovery attempt 2 failed in the peer factory; retry 1 scheduled at 500 ms.
      await waitAttempts(attempts, 2);
      let scheduled = await waitScheduled(before, 1);
      assert.equal(scheduled[0].attempt, 1);
      assert.equal(scheduled[0].delayMs, localWebrtcReconnectPolicy.initialDelayMs);
      assert.match(scheduled[0].detail, /peer factory failure 2/);
      assert.equal(webRtcLifecycleDiagnostic(scheduled[0]).id, "webrtc-data-channel-state");
      assert.equal(webRtcLifecycleDiagnostic(scheduled[0]).severity, "warning");
      assert.equal(liveTimersWithDelay(localWebrtcReconnectPolicy.attemptTimeoutMs, before).length, 0, "failed attempt cleared its deadline");

      await fireRetryTimer(500);
      await waitAttempts(attempts, 3);
      scheduled = await waitScheduled(before, 2);
      assert.equal(scheduled[1].delayMs, 1000);
      assert.equal([...timers.values()].filter((entry) => [500, 1000].includes(entry.delay)).length, 1, "one live retry timer");

      await fireRetryTimer(1000);
      await waitAttempts(attempts, 4);
      assert.equal(channels.length, 2, "attempt 4 created the recovery peer");
      await waitForTestCondition(() => channels[1].helloAckDelivered === true);
      await waitForTestCondition(() => channels[1].sent.length >= 1);
      const recoverySubscribe = (await decryptAll(channels[1])).find((request) => request.type === "subscribe_entities");
      assert.ok(recoverySubscribe, "recovered peer re-subscribed without a caller request");
      assert.notEqual(recoverySubscribe.subscription_id, firstSubscribe.subscription_id);
      await answerEntitySubscribe(channels, 1, "reconnect-a-subscribe-2");
      await emitChunkedTestResponse(channels[1], secret, {
        type: "entity_upsert", subscription_id: recoverySubscribe.subscription_id, entity_type: "session", snapshot_seq: 1,
        id: "after-recovery", entity: { session_uuid: "after-recovery", lifecycle: "running" }
      }, { messageId: "reconnect-a-frame", deliveryKind: "daemon_entity_frame" });
      await waitForTestCondition(() => frames.some((frame) => frame.id === "after-recovery"));
      assert.equal(eventsSince(before, "hello-ack").length, 2, "one Hello per successful peer");
      assert.equal(eventsSince(before, "reconnect-attempt").length, 3, "attempts 2, 3, and 4 were reconnect attempts");
      assert.equal(liveTimersWithDelay(500, before).length + liveTimersWithDelay(1000, before).length, 0, "no retry timer after recovery");

      // Held demand survives the recovery: a later loss recovers immediately without a request.
      const secondLoss = lifecycleEvents.length;
      channels[1].close();
      await flushMicrotasks();
      await flushMicrotasks();
      await waitAttempts(attempts, 5, "immediate recovery attempt after the second loss");
      await waitForTestCondition(() => channels[2]?.helloAckDelivered === true);
      assert.equal(eventsSince(secondLoss, "reconnect-scheduled").length, 0, "immediate attempt succeeded");
      await waitForTestCondition(() => channels[2].sent.length >= 1);
      assert.ok((await decryptAll(channels[2])).some((request) => request.type === "subscribe_entities"));
      client.disconnect();
      assert.equal([...timers.values()].filter((entry) => [500, 1000, 2000].includes(entry.delay)).length, 0, "disconnect leaves no retry timer");
    }
    // (a2) Backoff restarts at the initial delay after an authenticated Hello.
    {
      const before = lifecycleEvents.length;
      const { client, channels, attempts } = makeClient({ failAttempts: new Set([2, 3, 5]) });
      const subscription = client.subscribeEntityFrames("session", () => undefined);
      await answerEntitySubscribe(channels, 0, "reconnect-a2-subscribe-1");
      await subscription.ready;
      channels[0].close();
      await flushMicrotasks();
      await flushMicrotasks();
      await fireRetryTimer(500);
      await waitScheduled(before, 2);
      await fireRetryTimer(1000);
      await waitAttempts(attempts, 4);
      await waitForTestCondition(() => channels[1]?.helloAckDelivered === true);
      await answerEntitySubscribe(channels, 1, "reconnect-a2-subscribe-2");
      const secondLoss = lifecycleEvents.length;
      channels[1].close();
      await flushMicrotasks();
      await flushMicrotasks();
      await waitAttempts(attempts, 5, "attempt 5 failed immediately after the second loss");
      const scheduled = await waitScheduled(secondLoss, 1);
      assert.equal(scheduled[0].attempt, 1, "retry counter restarted after the authenticated Hello");
      assert.equal(scheduled[0].delayMs, 500);
      await fireRetryTimer(500);
      await waitForTestCondition(() => channels[2]?.helloAckDelivered === true);
      client.disconnect();
      assert.equal(eventsSince(before, "reconnect-scheduled").length, 3);
    }
    // (b) Terminal-only demand through the real HubTerminalDataPlane: no entity subscription.
    {
      const before = lifecycleEvents.length;
      const { client, channels, attempts } = makeClient({ failAttempts: new Set([2, 3]) });
      const statuses = [];
      const plane = createHubTerminalDataPlane({ sessionId: "reconnect-terminal-session", bridge: client });
      const installs = [];
      bindGhostsnpInstaller(plane, installs);
      const outputs = [];
      plane.subscribeStatus((status) => statuses.push(status));
      plane.subscribeOutput((data) => outputs.push(data));
      await waitForTestCondition(() => channels.length === 1 && channels[0].sent.length >= 1);
      const firstAttach = (await decryptAll(channels[0])).find((request) => request.type === "attach");
      assert.ok(firstAttach, "terminal attach was requested on the first peer");
      assert.equal(firstAttach.session_id, "reconnect-terminal-session");

      channels[0].close();
      await flushMicrotasks();
      await flushMicrotasks();
      assert.ok(statuses.some((status) => /data channel lost/.test(status.message)), "data plane observed the loss");
      await waitAttempts(attempts, 2, "terminal demand alone triggered the immediate recovery attempt");
      await waitScheduled(before, 1);
      await fireRetryTimer(500);
      await waitAttempts(attempts, 3);
      await waitScheduled(before, 2);
      await fireRetryTimer(1000);
      await waitAttempts(attempts, 4);
      await waitForTestCondition(() => channels[1]?.helloAckDelivered === true);
      await waitForTestCondition(() => statuses.some((status) => /Reattaching terminal stream after WebRTC recovery/.test(status.message)));
      // The data plane detaches the abandoned subscription first and awaits the answer.
      await waitForTestCondition(() => channels[1].sent.length >= 1);
      const detach = (await decryptAll(channels[1])).find((request) => request.type === "detach");
      assert.ok(detach, "abandoned subscription was detached on the recovered peer");
      assert.equal(detach.subscription_id, firstAttach.subscription_id);
      await emitChunkedTestResponse(channels[1], secret, { kind: "events", events: [] }, { messageId: "reconnect-b-detach" });
      await waitForTestCondition(() => channels[1].sent.length >= 2);
      const recovered = await decryptAll(channels[1]);
      const reattach = recovered.find((request) => request.type === "attach");
      assert.ok(reattach, "terminal reattached on the recovered peer without a caller request");
      assert.notEqual(reattach.subscription_id, firstAttach.subscription_id);
      assert.equal(recovered.some((request) => request.type === "subscribe_entities"), false, "no entity demand existed");

      // Complete the actual admission on the recovered peer: reservation, reserved-channel
      // Hello, snapshot READY and FINISH, Attached, then live output into the real data plane.
      await emitChunkedTestResponse(channels[1], secret, {
        kind: "terminal_reservation",
        terminal_reservation: {
          session_id: "reconnect-terminal-session",
          subscription_id: reattach.subscription_id,
          generation: 9101,
          peer_generation: 4,
          label: "r-reconnect-terminal",
          expires_in_seconds: 30
        },
        events: []
      }, { messageId: "reconnect-b-reservation" });
      await waitForTestCondition(() =>
        channels[1].createdDataChannels.some((channel) => channel.label === "r-reconnect-terminal" && channel.helloAckDelivered === true)
      );
      const terminalChannel = channels[1].createdDataChannels.find((channel) => channel.label === "r-reconnect-terminal");
      assert.equal(terminalChannel.readyState, "open");
      // Attach also reads mode flags and the screen over the control channel; answer as they arrive.
      const answered = new Set();
      const answerControlReads = async () => {
        for (const [index, sent] of channels[1].sent.entries()) {
          if (answered.has(index)) continue;
          let request;
          try {
            request = await decryptTestEnvelope(secret, sent);
          } catch {
            continue;
          }
          if (request.type === "read_mode_flags") {
            answered.add(index);
            await emitChunkedTestResponse(channels[1], secret,
              { kind: "read_mode_flags", mode_flags: testModeFlags("reconnect-terminal-session"), events: [] },
              { messageId: `reconnect-b-mode-flags-${index}` });
          } else if (request.type === "read_screen") {
            answered.add(index);
            await emitChunkedTestResponse(channels[1], secret,
              { kind: "read_screen", read_screen: { session_id: "reconnect-terminal-session", text: "" }, events: [] },
              { messageId: `reconnect-b-read-screen-${index}` });
          }
        }
      };
      const terminalFrame = (frame, messageId) => emitChunkedTestResponse(terminalChannel, secret, {
        session_id: "reconnect-terminal-session",
        subscription_id: reattach.subscription_id,
        ...frame
      }, { messageId, deliveryKind: "daemon_terminal_frame" });
      const snapshot = { type: "snapshot", payload_base64: ghostsnpFixturePayloadBase64, payload_encoding: "base64", bytes: ghostsnpFixtureBytes };
      await terminalFrame(snapshot, "reconnect-b-snapshot-ready");
      await terminalFrame(snapshot, "reconnect-b-snapshot-finish");
      await terminalFrame({ type: "attach_state", state: "attached" }, "reconnect-b-attached");
      for (let round = 0; round < 20 && !statuses.some((status) => status.state === "attached"); round += 1) {
        await answerControlReads();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      assert.ok(statuses.some((status) => status.state === "attached"), "data plane reached Attached on the recovered peer");
      await terminalFrame({
        type: "terminal_output",
        payload_base64: Buffer.from("recovered-output").toString("base64"),
        payload_encoding: "base64",
        bytes: 16
      }, "reconnect-b-output");
      await waitForTestCondition(() => outputs.some((data) => Buffer.from(data).toString("utf8") === "recovered-output"));
      assert.equal(installs.length, 2, "both snapshot frames reached the real snapshot reader");
      void plane.detach().catch(() => undefined);
      client.disconnect();
    }
    // (c) Duplicate failure signals and concurrent requests during the retry wait.
    {
      const before = lifecycleEvents.length;
      const { client, channels, attempts } = makeClient({ failAttempts: new Set([2]) });
      const subscription = client.subscribeEntityFrames("session", () => undefined);
      await answerEntitySubscribe(channels, 0, "reconnect-c-subscribe-1");
      await subscription.ready;
      // A malformed frame fails the peer generation; the close that follows is a duplicate signal.
      channels[0].emitMessage("not-a-chunk");
      await flushMicrotasks();
      await flushMicrotasks();
      channels[0].close();
      channels[0].close();
      await flushMicrotasks();
      await flushMicrotasks();
      await waitAttempts(attempts, 2, "duplicate signals produced one recovery attempt");
      assert.equal(eventsSince(before, "reconnect-scheduled").length, 1);
      assert.equal(liveTimersWithDelay(500, before).length, 1);
      // Two concurrent requests during the wait start one attempt now and cancel the timer.
      const first = client.request({ type: "list_apps" });
      const second = client.request({ type: "status" });
      await flushMicrotasks();
      await waitAttempts(attempts, 3, "requests started exactly one attempt");
      assert.equal(liveTimersWithDelay(500, before).length, 0, "retry timer cancelled by the caller-started attempt");
      await waitForTestCondition(() => channels[1]?.helloAckDelivered === true);
      await waitForTestCondition(() => channels[1].sent.length >= 3);
      const requests = await decryptAll(channels[1]);
      assert.equal(requests.filter((request) => request.type === "list_apps").length, 1);
      assert.equal(requests.filter((request) => request.type === "status").length, 1);
      assert.equal(requests.filter((request) => request.type === "subscribe_entities").length, 1);
      await emitChunkedTestResponse(channels[1], secret, { kind: "entity_subscribed", events: [], diagnostics: [] }, { messageId: "reconnect-c-subscribe-2" });
      await emitChunkedTestResponse(channels[1], secret, { kind: "apps", apps: [], events: [], diagnostics: [] }, { messageId: "reconnect-c-apps" });
      await emitChunkedTestResponse(channels[1], secret, { kind: "status", status: null, sessions: [], packages: [], events: [], diagnostics: [] }, { messageId: "reconnect-c-status" });
      assert.equal((await first).kind, "apps");
      assert.equal((await second).kind, "status");
      await waitAttempts(attempts, 3);
      client.disconnect();
    }
    // (d) Cancellation during bootstrap, signaling, and Hello.
    {
      // Bootstrap: the provider cannot be aborted; its late result is fenced by ownership.
      let resolveBootstrap;
      const bootstrapGate = new Promise((resolve) => { resolveBootstrap = resolve; });
      const bootstrapClient = makeClient({ refreshBootstrap: () => bootstrapGate });
      const before = lifecycleEvents.length;
      const pending = bootstrapClient.client.request({ type: "status" });
      await flushMicrotasks();
      bootstrapClient.client.disconnect();
      await assert.rejects(pending, /disconnected/);
      resolveBootstrap(localWebrtcBootstrapFixture);
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(bootstrapClient.attempts(), 0, "late bootstrap did not create a peer");
      assert.equal(eventsSince(before).length, 0, "no lifecycle events after disconnect");
      assert.equal(liveTimersWithDelay(localWebrtcReconnectPolicy.attemptTimeoutMs, before).length, 0);

      // Signaling: fetch ignores the abort signal; the late answer must not open a peer.
      let resolveSignal;
      let signalInit;
      const signalClient = makeClient({
        fetchImpl: (_url, init) => new Promise((resolve) => { signalInit = init; resolveSignal = resolve; })
      });
      const signalBefore = lifecycleEvents.length;
      const signalPending = signalClient.client.request({ type: "status" });
      await waitForTestCondition(() => Boolean(resolveSignal));
      assert.ok(signalInit.signal, "signaling fetch received an abort signal");
      assert.equal(signalInit.signal.aborted, false);
      signalClient.client.disconnect();
      assert.equal(signalInit.signal.aborted, true, "disconnect aborted the in-flight signaling fetch");
      await assert.rejects(signalPending, /disconnected/);
      resolveSignal({ ok: true, json: async () => ({ payload: { local_webrtc_answer: { grant_id: "grant-test", answer: { type: "answer", sdp: "answer-sdp" } } } }) });
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(signalClient.channels[0].readyState, "closed", "the superseded attempt closed its own channel");
      assert.equal(signalClient.channels[0].helloSent.length, 0, "no Hello on a cancelled attempt");
      assert.equal(eventsSince(signalBefore).some((detail) => detail.type === "data-channel-open" || detail.type === "hello-ack"), false);

      // Hello: cancellation after the Hello send and before its ack.
      const helloClient = makeClient({ autoHello: false });
      const helloBefore = lifecycleEvents.length;
      const helloPending = helloClient.client.request({ type: "status" });
      await waitForTestCondition(() => helloClient.channels[0]?.sent.length === 1);
      const hello = await decryptTestEnvelope(secret, helloClient.channels[0].sent[0]);
      assert.equal(hello.protocol, "botster-hub-daemon-v1");
      helloClient.client.disconnect();
      await assert.rejects(helloPending, /disconnected/);
      await emitChunkedTestResponse(helloClient.channels[0], secret, {
        protocol: "botster-hub-daemon-v1",
        compatibility: { protocol: "botster-hub-daemon-v1", protocol_version: 8, features: [], conformance_fixture_revision: 48 },
        terminal_compatibility: null,
        diagnostics: []
      }, { messageId: "late-hello-ack" });
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(eventsSince(helloBefore, "hello-ack").length, 0, "late Hello ack after disconnect emitted nothing");
      assert.equal(eventsSince(helloBefore, "encrypted-stream-ready").length, 0);
    }
    // (e) Obsolete attempt A settles after attempt B succeeds: late rejection and late resolution.
    for (const lateOutcome of ["reject", "resolve"]) {
      const before = lifecycleEvents.length;
      let settleA;
      const blockedSignal = new Promise((resolve, reject) => {
        settleA = lateOutcome === "reject"
          ? () => reject(new Error("late signaling rejection for A"))
          : () => resolve({ ok: true, json: async () => ({ payload: { local_webrtc_answer: { grant_id: "grant-test", answer: { type: "answer", sdp: "answer-sdp" } } } }) });
      });
      // Signal call 2 belongs to attempt A (the immediate recovery attempt).
      const { client, channels, attempts } = makeClient({ blockAttempts: new Map([[2, blockedSignal]]) });
      const subscription = client.subscribeEntityFrames("session", () => undefined);
      await answerEntitySubscribe(channels, 0, `reconnect-e-${lateOutcome}-subscribe-1`);
      await subscription.ready;
      channels[0].close();
      await flushMicrotasks();
      await flushMicrotasks();
      await waitAttempts(attempts, 2, "attempt A started");
      assert.equal(channels[1].readyState, "connecting", "A is blocked in signaling");
      await fireDeadlineTimer();
      const scheduled = await waitScheduled(before, 1);
      assert.match(scheduled[0].detail, /timed out after/);
      assert.equal(channels[1].readyState, "closed", "A's deadline closed A's channel");
      await fireRetryTimer(500);
      await waitAttempts(attempts, 3, "attempt B started");
      await waitForTestCondition(() => channels[2]?.helloAckDelivered === true);
      await answerEntitySubscribe(channels, 2, `reconnect-e-${lateOutcome}-subscribe-2`);
      const helloAcksBefore = eventsSince(before, "hello-ack").length;
      assert.equal(helloAcksBefore, 2, "Hello on the first peer and on B");
      const timersBefore = timers.size;
      settleA();
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(channels[2].readyState, "open", "B stays current after A settles late");
      assert.equal(eventsSince(before, "hello-ack").length, helloAcksBefore, "no Hello for obsolete A");
      assert.equal(eventsSince(before, "reconnect-scheduled").length, 1, "A's late settlement scheduled nothing");
      assert.equal(timers.size, timersBefore, "A's late settlement created or cleared no timer");
      // The client still routes through B.
      const probe = client.request({ type: "status" });
      await waitForTestCondition(() => channels[2].sent.length >= 2);
      await emitChunkedTestResponse(channels[2], secret, { kind: "status", status: null, sessions: [], packages: [], events: [], diagnostics: [] }, { messageId: `reconnect-e-${lateOutcome}-status` });
      assert.equal((await probe).kind, "status");
      await waitAttempts(attempts, 3);
      client.disconnect();
    }
    // (f) Capped backoff through repeated failure, with one live timer at any time.
    {
      const before = lifecycleEvents.length;
      const { client, channels, attempts } = makeClient({ failAttempts: new Set([2, 3, 4, 5, 6, 7, 8]) });
      const subscription = client.subscribeEntityFrames("session", () => undefined);
      await answerEntitySubscribe(channels, 0, "reconnect-f-subscribe-1");
      await subscription.ready;
      channels[0].close();
      await flushMicrotasks();
      await flushMicrotasks();
      const expectedDelays = [500, 1000, 2000, 4000, 8000, 10_000, 10_000];
      for (const [index, delay] of expectedDelays.entries()) {
        const scheduled = await waitScheduled(before, index + 1);
        assert.equal(scheduled[index].attempt, index + 1);
        assert.equal(scheduled[index].delayMs, delay);
        assert.equal(deadlineCleared(), true, "failed attempt cleared its deadline");
        assert.equal([...timers.values()].filter((entry) => entry.eventIndex > before && expectedDelays.includes(entry.delay)).length, 1, "one live retry timer");
        await fireRetryTimer(delay);
      }
      await waitAttempts(attempts, 9, "attempt 9 followed the seventh retry");
      await waitForTestCondition(() => channels[1]?.helloAckDelivered === true);
      await answerEntitySubscribe(channels, 1, "reconnect-f-subscribe-2");
      assert.equal(eventsSince(before, "reconnect-scheduled").length, expectedDelays.length);
      client.disconnect();
      assert.equal([...timers.values()].filter((entry) => entry.eventIndex > before && expectedDelays.includes(entry.delay)).length, 0);
    }
    // (g) Lifecycle callbacks are synchronous external calls; each boundary is fenced.
    {
      // hello-ack callback disconnects: the stream never becomes ready, nothing is restored.
      const helloBefore = lifecycleEvents.length;
      const helloClient = makeClient({
        onLifecycle: (event, client) => {
          if (event.type === "hello-ack") client.disconnect();
        }
      });
      helloClient.client.subscribeEntityFrames("session", () => undefined);
      await waitForTestCondition(() => eventsSince(helloBefore, "hello-ack").length === 1);
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(eventsSince(helloBefore, "encrypted-stream-ready").length, 0, "no ready after a disconnecting hello-ack callback");
      assert.equal((await decryptAll(helloClient.channels[0])).some((request) => request.type === "subscribe_entities"), false, "no subscription restore after disconnect");
      await assert.rejects(helloClient.client.request({ type: "status" }), /disconnected/);

      // reconnect-attempt callback disconnects: no open work starts and no deadline timer survives.
      const attemptBefore = lifecycleEvents.length;
      const attemptClient = makeClient({
        onLifecycle: (event, client) => {
          if (event.type === "reconnect-attempt") client.disconnect();
        }
      });
      const attemptSubscription = attemptClient.client.subscribeEntityFrames("session", () => undefined);
      await answerEntitySubscribe(attemptClient.channels, 0, "reconnect-g-attempt-subscribe");
      await attemptSubscription.ready;
      attemptClient.channels[0].close();
      await waitForTestCondition(() => eventsSince(attemptBefore, "reconnect-attempt").length === 1);
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(attemptClient.attempts(), 1, "the cancelled attempt created no peer");
      assert.equal(liveTimersWithDelay(localWebrtcReconnectPolicy.attemptTimeoutMs, attemptBefore).length, 0, "no deadline timer after the callback disconnect");
      assert.equal(eventsSince(attemptBefore, "reconnect-scheduled").length, 0);

      // reconnect-scheduled callback disconnects: no retry timer survives.
      const scheduledBefore = lifecycleEvents.length;
      const scheduledClient = makeClient({
        failAttempts: new Set([2]),
        onLifecycle: (event, client) => {
          if (event.type === "reconnect-scheduled") client.disconnect();
        }
      });
      const scheduledSubscription = scheduledClient.client.subscribeEntityFrames("session", () => undefined);
      await answerEntitySubscribe(scheduledClient.channels, 0, "reconnect-g-scheduled-subscribe");
      await scheduledSubscription.ready;
      scheduledClient.channels[0].close();
      await waitScheduled(scheduledBefore, 1);
      await flushMicrotasks();
      assert.equal(liveTimersWithDelay(500, scheduledBefore).length, 0, "no retry timer after the callback disconnect");
      assert.equal(scheduledClient.attempts(), 2);

      // data-channel-closed callback starts a new connection: the old close handler must not
      // fail the new attempt, and the new peer serves the request and restores the subscription.
      const closedBefore = lifecycleEvents.length;
      let callbackRequest;
      const closedClient = makeClient({
        onLifecycle: (event, client) => {
          if (event.type === "data-channel-closed" && !callbackRequest) {
            callbackRequest = client.request({ type: "status" });
          }
        }
      });
      const closedSubscription = closedClient.client.subscribeEntityFrames("session", () => undefined);
      await answerEntitySubscribe(closedClient.channels, 0, "reconnect-g-closed-subscribe");
      await closedSubscription.ready;
      closedClient.channels[0].close();
      await waitForTestCondition(() => Boolean(callbackRequest));
      await waitAttempts(closedClient.attempts, 2);
      await waitForTestCondition(() => closedClient.channels[1]?.helloAckDelivered === true);
      await waitForTestCondition(() => closedClient.channels[1].sent.length >= 2);
      const callbackRequests = await decryptAll(closedClient.channels[1]);
      assert.equal(callbackRequests.filter((request) => request.type === "status").length, 1);
      assert.equal(callbackRequests.filter((request) => request.type === "subscribe_entities").length, 1);
      await emitChunkedTestResponse(closedClient.channels[1], secret, { kind: "status", status: null, sessions: [], packages: [], events: [], diagnostics: [] }, { messageId: "reconnect-g-closed-status" });
      assert.equal((await callbackRequest).kind, "status");
      assert.equal(eventsSince(closedBefore, "reconnect-scheduled").length, 0, "the old close handler scheduled nothing against the new attempt");
      assert.equal(closedClient.attempts(), 2);
      closedClient.client.disconnect();
    }

    // (g2) Terminal-only demand: the loss callback detaches the terminal listener and another
    // callback starts attempt B. Demand captured before the callbacks stays sticky, so when B
    // fails recovery continues without a new caller request and the terminal reattaches.
    {
      const before = lifecycleEvents.length;
      let callbackRequest;
      const { client, channels, attempts } = makeClient({
        failAttempts: new Set([2]),
        onLifecycle: (event, owner) => {
          // This option callback runs before the window dispatch that detaches the data
          // plane's terminal listener. Attempt B starts here; the listener detaches next; the
          // old close handler then takes the generation-mismatch branch.
          if (event.type === "data-channel-closed" && !callbackRequest) {
            callbackRequest = owner.request({ type: "status" }).catch((error) => error);
          }
        }
      });
      const statuses = [];
      const plane = createHubTerminalDataPlane({ sessionId: "reconnect-terminal-callback-session", bridge: client });
      plane.subscribeStatus((status) => statuses.push(status));
      plane.subscribeOutput(() => undefined);
      await waitForTestCondition(() => channels.length === 1 && channels[0].sent.length >= 1);
      const firstAttach = (await decryptAll(channels[0])).find((request) => request.type === "attach");
      assert.ok(firstAttach);
      channels[0].close();
      await waitForTestCondition(() => Boolean(callbackRequest));
      // Attempt B (2) was started by the callback and fails; the captured demand schedules retry 1.
      await waitAttempts(attempts, 2);
      const scheduled = await waitScheduled(before, 1);
      assert.equal(scheduled[0].delayMs, 500);
      assert.ok((await callbackRequest) instanceof Error, "the callback's request rejected with B");
      await fireRetryTimer(500);
      await waitAttempts(attempts, 3);
      await waitForTestCondition(() => channels[1]?.helloAckDelivered === true);
      await waitForTestCondition(() => statuses.some((status) => /Reattaching terminal stream after WebRTC recovery/.test(status.message)));
      await waitForTestCondition(() => channels[1].sent.length >= 1);
      const detach = (await decryptAll(channels[1])).find((request) => request.type === "detach");
      assert.ok(detach, "abandoned subscription detached on the recovered peer");
      await emitChunkedTestResponse(channels[1], secret, { kind: "events", events: [] }, { messageId: "reconnect-g2-detach" });
      await waitForTestCondition(() => channels[1].sent.length >= 2);
      const reattach = (await decryptAll(channels[1])).find((request) => request.type === "attach");
      assert.ok(reattach, "terminal reattached after the callback-started attempt failed, without a new caller request");
      assert.notEqual(reattach.subscription_id, firstAttach.subscription_id);
      assert.equal(eventsSince(before, "reconnect-scheduled").length, 1);
      void plane.detach().catch(() => undefined);
      client.disconnect();
    }

    // (h) Absolute deadline with a bootstrap provider that never settles.
    {
      const before = lifecycleEvents.length;
      let resolveBootstrap;
      const neverBootstrap = new Promise((resolve) => { resolveBootstrap = resolve; });
      const { client, attempts } = makeClient({ refreshBootstrap: () => neverBootstrap });
      const pending = client.request({ type: "status" });
      await flushMicrotasks();
      const deadlines = liveTimersWithDelay(localWebrtcReconnectPolicy.attemptTimeoutMs, before - 1);
      assert.equal(deadlines.length, 1, "exactly one live attempt deadline timer");
      fireTimer(deadlines[0][0]);
      await assert.rejects(pending, /timed out after 10000 ms/);
      assert.equal(attempts(), 0, "no peer was created");
      assert.equal(eventsSince(before, "reconnect-scheduled").length, 0, "no demand, so no retry");
      // The provider settles late; its result stays fenced.
      resolveBootstrap(localWebrtcBootstrapFixture);
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(attempts(), 0, "late bootstrap did not create a peer");
      assert.equal(eventsSince(before).length, 0, "no lifecycle events from the expired attempt");
      assert.equal(liveTimersWithDelay(localWebrtcReconnectPolicy.attemptTimeoutMs, before - 1).length, 0);
      client.disconnect();
    }
  } finally {
    globalThis.window.setTimeout = originalSetTimeout;
    globalThis.window.clearTimeout = originalClearTimeout;
    globalThis.window.dispatchEvent = originalDispatch;
  }
}
