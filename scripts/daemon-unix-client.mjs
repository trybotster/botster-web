import { connect } from "node:net";

const DAEMON_REQUEST_MS = 30_000;

/**
 * Sends one request on one Unix socket connection. This client never subscribes.
 * It discards valid event, entity, and terminal deliveries while it waits for its response.
 */
export async function sendDaemonUnixRequest({
  socketPath,
  request,
  protocol,
  compatibilityRequirement,
  framing
}) {
  const socket = connect(socketPath);
  const deadlineAt = Date.now() + DAEMON_REQUEST_MS;
  let completed = false;
  try {
    await waitForSocketConnect(socket, deadlineAt);
    socket.write(encodeUnixControlFrame({
      frame: "hello",
      hello: {
        protocol,
        compatibility: compatibilityRequirement
      }
    }, framing));
    const hello = await readUnixControlFrame(socket, deadlineAt, framing);
    assertServerFrame(hello);
    if (hello.frame === "close") {
      if (!isRecord(hello.reason)) throw new Error("daemon sent a malformed close frame during hello");
      throw new Error(`daemon closed during hello: ${JSON.stringify(hello.reason)}`);
    }
    if (hello.frame !== "hello_ack" || !isRecord(hello.ack) || hello.ack.protocol !== protocol) {
      throw new Error("daemon hello protocol mismatch");
    }
    assertDaemonCompatibility(hello.ack.compatibility, compatibilityRequirement);

    socket.write(encodeUnixControlFrame({ frame: "request", request_id: "1", request }, framing));
    while (true) {
      const reply = await readUnixControlFrame(socket, deadlineAt, framing);
      assertServerFrame(reply);
      if (reply.frame === "close") {
        if (!isRecord(reply.reason)) throw new Error("daemon sent a malformed close frame before reply");
        throw new Error(`daemon closed before reply: ${JSON.stringify(reply.reason)}`);
      }
      if (reply.frame === "event") {
        if (!isRecord(reply.event)) throw new Error("daemon sent a malformed event frame");
        continue;
      }
      if (reply.frame === "entity") {
        if (!isRecord(reply.entity)) throw new Error("daemon sent a malformed entity frame");
        continue;
      }
      if (reply.frame !== "response") {
        throw new Error(`unexpected daemon reply: ${JSON.stringify(reply)}`);
      }
      if (reply.request_id !== "1") {
        throw new Error(`daemon returned unknown request_id ${JSON.stringify(reply.request_id)}`);
      }
      if (!isRecord(reply.response)) {
        throw new Error("daemon sent a malformed response frame");
      }
      completed = true;
      return reply.response;
    }
  } finally {
    if (completed) {
      socket.end();
    } else {
      socket.destroy();
    }
  }
}

function waitForSocketConnect(socket, deadlineAt) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("daemon socket closed before connect"));
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error(`daemon request deadline ${DAEMON_REQUEST_MS} ms exceeded`));
    };
    const timer = setTimeout(onTimeout, remainingDeadlineMs(deadlineAt));
    socket.once("connect", onConnect);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

function encodeUnixControlFrame(value, framing) {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const frameLength = 1 + payload.length;
  if (frameLength > framing.maxFrameBytes) {
    throw new Error(`daemon control frame exceeds ${framing.maxFrameBytes} bytes`);
  }
  const frame = Buffer.allocUnsafe(framing.lengthPrefixBytes + frameLength);
  frame.writeUInt32LE(frameLength, 0);
  frame[framing.lengthPrefixBytes] = framing.controlContainer;
  payload.copy(frame, framing.lengthPrefixBytes + 1);
  return frame;
}

async function readUnixControlFrame(socket, deadlineAt, framing) {
  while (true) {
    assertWithinDeadline(deadlineAt);
    const prefix = await readSocketBytes(socket, framing.lengthPrefixBytes, deadlineAt);
    const frameLength = prefix.readUInt32LE(0);
    if (frameLength < 2 || frameLength > framing.maxFrameBytes) {
      throw new Error(`invalid daemon frame length ${frameLength}`);
    }
    const frame = await readSocketBytes(socket, frameLength, deadlineAt);
    if (frame[0] === framing.terminalContainer) {
      assertUnixTerminalContainer(frame, framing);
      continue;
    }
    if (frame[0] !== framing.controlContainer) {
      throw new Error(`unexpected daemon container ${frame[0]}`);
    }
    return JSON.parse(frame.subarray(1).toString("utf8"));
  }
}

async function readSocketBytes(socket, length, deadlineAt) {
  const chunks = [];
  let received = 0;
  while (received < length) {
    assertWithinDeadline(deadlineAt);
    // Read whatever is buffered. A sized read(n) returns null until n bytes are buffered,
    // and the socket stops filling at its high-water mark, so a frame larger than that
    // mark would never arrive. Any bytes past this frame go back to the stream.
    const chunk = socket.read();
    if (chunk !== null) {
      const needed = length - received;
      if (chunk.length > needed) {
        socket.unshift(chunk.subarray(needed));
        chunks.push(chunk.subarray(0, needed));
        received += needed;
      } else {
        chunks.push(chunk);
        received += chunk.length;
      }
      continue;
    }
    if (socket.readableEnded || socket.destroyed) {
      throw new Error("daemon socket closed before reply");
    }
    await waitForSocketReadable(socket, deadlineAt);
  }
  return chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, length);
}

function waitForSocketReadable(socket, deadlineAt) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("readable", onReadable);
      socket.off("error", onError);
      socket.off("end", onEnd);
      socket.off("close", onClose);
    };
    const onReadable = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("daemon socket closed before reply"));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("daemon socket closed before reply"));
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error(`daemon request deadline ${DAEMON_REQUEST_MS} ms exceeded`));
    };

    const timer = setTimeout(onTimeout, remainingDeadlineMs(deadlineAt));
    socket.once("readable", onReadable);
    socket.once("error", onError);
    socket.once("end", onEnd);
    socket.once("close", onClose);
  });
}

function remainingDeadlineMs(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

function assertWithinDeadline(deadlineAt) {
  if (Date.now() >= deadlineAt) {
    throw new Error(`daemon request deadline ${DAEMON_REQUEST_MS} ms exceeded`);
  }
}

function assertServerFrame(frame) {
  if (!isRecord(frame) || typeof frame.frame !== "string") {
    throw new Error("daemon sent a malformed control frame");
  }
}

function assertUnixTerminalContainer(frame, framing) {
  const fixedBytes = 1 + 2 + 8 + 4;
  if (frame.length < fixedBytes + 1) {
    throw new Error("daemon sent a truncated terminal container");
  }
  const routeLength = frame.readUInt16LE(1);
  if (
    routeLength < 1 ||
    routeLength > framing.maxTerminalRouteBytes ||
    frame.length < fixedBytes + routeLength
  ) {
    throw new Error("daemon sent an invalid terminal container route");
  }
  new TextDecoder("utf-8", { fatal: true }).decode(frame.subarray(3, 3 + routeLength));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertDaemonCompatibility(compatibility, required) {
  const features = Array.isArray(compatibility?.features) ? compatibility.features : [];
  const missing = required.required_features.filter((feature) => !features.includes(feature));
  if (
    compatibility?.protocol !== required.protocol ||
    compatibility?.protocol_version !== required.protocol_version ||
    !Number.isInteger(compatibility?.conformance_fixture_revision) ||
    compatibility?.conformance_fixture_revision < required.minimum_conformance_fixture_revision ||
    missing.length > 0
  ) {
    throw new Error(
      `daemon compatibility mismatch: required=${JSON.stringify(required)} actual=${JSON.stringify(compatibility)} missing=${JSON.stringify(missing)}`
    );
  }
}
