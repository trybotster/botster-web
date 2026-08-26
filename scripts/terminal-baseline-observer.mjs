import { createHash } from "node:crypto";
import { watch } from "node:fs";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { inflateSync } from "node:zlib";
import {
  FROZEN_INPUTS,
  acceptShellClockHandshake,
  mapCssBoxToFramePixels,
  measureFrameScale,
  parseDispatcherLogLine,
  statisticSet
} from "./terminal-baseline-observation-format.mjs";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function substituteDispatcherSource(source, logPath) {
  if (source.includes("__BOTSTER_BASELINE_LOG_PATH__") === false) {
    throw new Error("dispatcher source is missing the log-path placeholder");
  }
  return source.split("__BOTSTER_BASELINE_LOG_PATH__").join(logPath);
}

export function handshakeCommand(handshakePath) {
  return `command -v bash >/dev/null 2>&1 && bash -c 'printf "%s %s\\n" "$EPOCHREALTIME" "$EPOCHREALTIME"' > ${handshakePath} || : > ${handshakePath}`;
}

export function dispatcherStartCommand(ptyClock, seedPath) {
  if (ptyClock === "shell_epochrealtime") {
    return `exec bash --noprofile --norc ${seedPath}`;
  }
  return `exec sh ${seedPath}`;
}

export function probeLine(marker) {
  return `${FROZEN_INPUTS.probe_prefix}${marker}`;
}

export function uniqueMarker(captureId, armId, family, repetition) {
  return `${captureId}-${armId}-${family}-${String(repetition).padStart(2, "0")}`;
}

export function sessionIdFromTerminalSubscription(subscriptionId) {
  const match = /^terminal_(.+)$/.exec(String(subscriptionId ?? ""));
  return match?.[1] ?? null;
}

export function installLegacyProductionSubscribeObserver(store = globalThis) {
  const sessionFromSubscription = (subscriptionId) => {
    const match = /^terminal_(.+)$/.exec(String(subscriptionId ?? ""));
    return match?.[1] ?? null;
  };
  if (store.__BOTSTER_BASELINE_JSON_OBSERVER__) {
    return store;
  }
  store.__BOTSTER_BASELINE_JSON_OBSERVER__ = true;
  store.__BOTSTER_BASELINE_CONTROL_INBOUND__ = store.__BOTSTER_BASELINE_CONTROL_INBOUND__ ?? [];
  store.__BOTSTER_BASELINE_CONTROL_OUTBOUND__ = store.__BOTSTER_BASELINE_CONTROL_OUTBOUND__ ?? [];
  store.__BOTSTER_BASELINE_ATTACH__ = store.__BOTSTER_BASELINE_ATTACH__ ?? {
    live: false,
    accepting: false
  };
  const json = store.JSON ?? JSON;
  const originalStringify = json.stringify.bind(json);
  const originalParse = json.parse.bind(json);
  json.stringify = function stringifyLegacySubscribe(value, ...rest) {
    if (value && value.type === "subscribe" && value.channel === "terminal") {
      store.__BOTSTER_BASELINE_CONTROL_OUTBOUND__.push({
        type: "subscribe",
        wire: "subscribe",
        source: "production_encoder",
        payload: value,
        subscription_id: value.subscriptionId,
        session_id: value.params?.session_uuid ?? value.params?.session_id
          ?? sessionFromSubscription(value.subscriptionId),
        at: Date.now()
      });
      store.__BOTSTER_BASELINE_ATTACH__.accepting = true;
    }
    if (value && value.type === "unsubscribe") {
      store.__BOTSTER_BASELINE_ATTACH__.live = false;
      store.__BOTSTER_BASELINE_ATTACH__.accepting = false;
    }
    return originalStringify(value, ...rest);
  };
  json.parse = function parseLegacySubscribed(text, reviver) {
    const value = originalParse(text, reviver);
    if (value && value.type === "subscribed" && value.subscriptionId) {
      if (store.__BOTSTER_BASELINE_ATTACH__.accepting) {
        store.__BOTSTER_BASELINE_CONTROL_INBOUND__.push({
          type: "subscribed",
          wire: "subscribe",
          source: "decoder",
          payload: value,
          session_id: value.session_uuid ?? value.session_id
            ?? sessionFromSubscription(value.subscriptionId),
          subscription_id: value.subscriptionId,
          generation: Object.hasOwn(value, "generation") ? value.generation : undefined,
          at: Date.now()
        });
        store.__BOTSTER_BASELINE_ATTACH__.live = true;
        store.__BOTSTER_BASELINE_ATTACH__.accepting = false;
      }
    }
    return value;
  };
  return store;
}

export function baselineObserverInitScript() {
  return () => {
    const sessionIdFromTerminalSubscription = (subscriptionId) => {
      const match = /^terminal_(.+)$/.exec(String(subscriptionId ?? ""));
      return match?.[1] ?? null;
    };
    if (!globalThis.__BOTSTER_BASELINE_JSON_OBSERVER__) {
      globalThis.__BOTSTER_BASELINE_JSON_OBSERVER__ = true;
      globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__ = globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__ ?? [];
      globalThis.__BOTSTER_BASELINE_CONTROL_OUTBOUND__ = globalThis.__BOTSTER_BASELINE_CONTROL_OUTBOUND__ ?? [];
      globalThis.__BOTSTER_BASELINE_ATTACH__ = globalThis.__BOTSTER_BASELINE_ATTACH__ ?? {
        live: false,
        accepting: false
      };
      const originalStringify = JSON.stringify.bind(JSON);
      const originalParse = JSON.parse.bind(JSON);
      JSON.stringify = function stringifyLegacySubscribe(value, ...rest) {
        if (value && value.type === "subscribe" && value.channel === "terminal") {
          globalThis.__BOTSTER_BASELINE_CONTROL_OUTBOUND__.push({
            type: "subscribe",
            wire: "subscribe",
            source: "production_encoder",
            payload: value,
            subscription_id: value.subscriptionId,
            session_id: value.params?.session_uuid ?? value.params?.session_id
              ?? sessionIdFromTerminalSubscription(value.subscriptionId),
            at: Date.now()
          });
          globalThis.__BOTSTER_BASELINE_ATTACH__.accepting = true;
        }
        if (value && value.type === "unsubscribe") {
          globalThis.__BOTSTER_BASELINE_ATTACH__.live = false;
          globalThis.__BOTSTER_BASELINE_ATTACH__.accepting = false;
        }
        return originalStringify(value, ...rest);
      };
      JSON.parse = function parseLegacySubscribed(text, reviver) {
        const value = originalParse(text, reviver);
        if (value && value.type === "subscribed" && value.subscriptionId) {
          if (globalThis.__BOTSTER_BASELINE_ATTACH__.accepting) {
            globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__.push({
              type: "subscribed",
              wire: "subscribe",
              source: "decoder",
              payload: value,
              session_id: value.session_uuid ?? value.session_id
                ?? sessionIdFromTerminalSubscription(value.subscriptionId),
              subscription_id: value.subscriptionId,
              generation: Object.hasOwn(value, "generation") ? value.generation : undefined,
              at: Date.now()
            });
            globalThis.__BOTSTER_BASELINE_ATTACH__.live = true;
            globalThis.__BOTSTER_BASELINE_ATTACH__.accepting = false;
          }
        }
        return value;
      };
    }
    const stamp = (item) => {
      if (item && typeof item === "object" && item.at == null) {
        item.at = Date.now();
        item.wall = Date.now();
      }
      return item;
    };
    const stampPush = (array) => {
      const original = array.push.bind(array);
      array.push = (...items) => original(...items.map(stamp));
      return array;
    };
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = {
      events: stampPush([]),
      terminal: stampPush([])
    };
    globalThis.__BOTSTER_BASELINE_KEYS__ = [];
    globalThis.window.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        globalThis.__BOTSTER_BASELINE_KEYS__.push({
          key: event.key,
          at: Date.now(),
          wall: Date.now()
        });
      }
    }, true);
    globalThis.window.addEventListener("botster:webrtc-daemon-lifecycle", (event) => {
      globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events?.push({
        kind: "webrtc_lifecycle",
        payload: event.detail
      });
    });
  };
}

export function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePngRgba(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("screencast frame is not a PNG");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG color type ${colorType} bit depth ${bitDepth}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let source = 0;
  let prior = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source];
    source += 1;
    const row = inflated.subarray(source, source + stride);
    source += stride;
    const reconstructed = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const raw = row[x];
      const left = x >= channels ? reconstructed[x - channels] : 0;
      const up = prior[x];
      const upLeft = x >= channels ? prior[x - channels] : 0;
      let value = raw;
      if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paethPredictor(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
      reconstructed[x] = value;
    }
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dest = (y * width + x) * 4;
      rgba[dest] = reconstructed[src];
      rgba[dest + 1] = reconstructed[src + 1];
      rgba[dest + 2] = reconstructed[src + 2];
      rgba[dest + 3] = channels === 4 ? reconstructed[src + 3] : 255;
    }
    prior = reconstructed;
  }
  return { width, height, rgba };
}

export function cropRgba(image, box) {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.max(1, Math.min(image.width - x, Math.ceil(box.width)));
  const height = Math.max(1, Math.min(image.height - y, Math.ceil(box.height)));
  const cropped = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const src = ((y + row) * image.width + x) * 4;
    image.rgba.copy(cropped, row * width * 4, src, src + width * 4);
  }
  return { width, height, rgba: cropped };
}

export function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function hashFiles(files) {
  const artifactSha256 = {};
  for (const file of files) {
    artifactSha256[file] = hashBytes(await readFile(file));
  }
  return artifactSha256;
}

export async function createLogWatcher(logPath) {
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, "");
  let buffer = "";
  const lines = [];
  const waiters = [];
  const emit = (line) => {
    const record = { line, at: Date.now() };
    lines.push(record);
    const pending = waiters.splice(0);
    for (const waiter of pending) waiter(record);
  };
  const consume = (chunk) => {
    buffer += chunk;
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      if (line.length > 0) emit(line);
    }
  };
  consume(await readFile(logPath, "utf8"));
  const watcher = watch(logPath, async () => {
    const text = await readFile(logPath, "utf8");
    const seen = lines.length;
    const next = text.split("\n").filter((line) => line.length > 0);
    for (let index = seen; index < next.length; index += 1) {
      emit(next[index]);
    }
  });
  return {
    lines,
    close() {
      watcher.close();
    },
    async waitForLine(predicate, timeoutMs = 10_000) {
      const existing = lines.find((entry) => predicate(entry.line));
      if (existing) return existing;
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = waiters.indexOf(onLine);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error("baseline log watcher timed out"));
        }, timeoutMs);
        const onLine = (entry) => {
          if (!predicate(entry.line)) {
            waiters.push(onLine);
            return;
          }
          clearTimeout(timer);
          resolve(entry);
        };
        waiters.push(onLine);
      });
    }
  };
}

export async function calibrateWatcherDetection(logPath, sampleCount = 20) {
  const watcher = await createLogWatcher(logPath);
  const samples = [];
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const marker = `watcher-cal-${index}`;
      const started = Date.now();
      await appendFile(logPath, `${marker}\n`);
      await watcher.waitForLine((line) => line === marker);
      samples.push(Date.now() - started);
    }
  } finally {
    watcher.close();
  }
  return statisticSet(samples);
}

export async function readHandshakeFile(handshakePath, hostDateNow) {
  let raw = "";
  try {
    raw = await readFile(handshakePath, "utf8");
  } catch {
    // Missing or unreadable handshake files fail closed as host_watcher.
  }
  return acceptShellClockHandshake(raw, hostDateNow);
}

export function paintTimestampMs(metadata) {
  if (metadata == null || metadata.timestamp == null) {
    return null;
  }
  return metadata.timestamp * 1000;
}

export async function startScreencastOracle(page, boundingBox) {
  const session = await page.context().newCDPSession(page);
  const frames = [];
  let discardedTimestampCount = 0;
  let scale = null;
  const transformSamples = [];
  const onFrame = async (payload) => {
    await session.send("Page.screencastFrameAck", { sessionId: payload.sessionId });
    const timestampMs = paintTimestampMs(payload.metadata);
    if (timestampMs == null) {
      discardedTimestampCount += 1;
      return;
    }
    const png = Buffer.from(payload.data, "base64");
    const image = decodePngRgba(png);
    const nextScale = measureFrameScale(image.width, payload.metadata.deviceWidth);
    if (scale == null) scale = nextScale;
    const cropBox = mapCssBoxToFramePixels(boundingBox, payload.metadata, scale);
    const cropped = cropRgba(image, cropBox);
    const digest = hashBytes(cropped.rgba);
    transformSamples.push({
      scale: nextScale,
      pageScaleFactor: payload.metadata.pageScaleFactor ?? 1,
      scrollOffsetX: payload.metadata.scrollOffsetX ?? 0,
      scrollOffsetY: payload.metadata.scrollOffsetY ?? 0
    });
    frames.push({
      at: timestampMs,
      sessionId: payload.sessionId,
      hash: digest,
      metadata: payload.metadata,
      scale: nextScale
    });
  };
  session.on("Page.screencastFrame", onFrame);
  await session.send("Page.startScreencast", {
    format: FROZEN_INPUTS.screencast.format,
    maxWidth: FROZEN_INPUTS.screencast.max_width,
    maxHeight: FROZEN_INPUTS.screencast.max_height
  });
  return {
    session,
    frames,
    transformSamples,
    get scale() {
      return scale;
    },
    get discardedTimestampCount() {
      return discardedTimestampCount;
    },
    async stop() {
      try {
        await session.send("Page.stopScreencast");
      } finally {
        session.off("Page.screencastFrame", onFrame);
        await session.detach();
      }
    }
  };
}

export function transformStable(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return false;
  }
  const first = samples[0];
  return samples.every((sample) =>
    sample.scale === first.scale
    && sample.pageScaleFactor === first.pageScaleFactor
    && sample.scrollOffsetX === first.scrollOffsetX
    && sample.scrollOffsetY === first.scrollOffsetY
  );
}

export function sustainedFrames(frames, startedAt, endedAt) {
  const windowed = frames.filter((frame) => frame.at >= startedAt && frame.at <= endedAt);
  return windowed.length >= 2;
}

export async function waitForHashChange(oracle, previousHash, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const latest = oracle.frames.at(-1);
    if (latest && latest.hash !== previousHash) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  throw new Error("paint oracle did not observe a sampled-region hash change");
}

export async function waitForHashSettle(oracle, settleWindowMs = FROZEN_INPUTS.settle_window_ms, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let last = oracle.frames.at(-1);
  if (!last) {
    throw new Error("paint oracle has no frames to settle");
  }
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    const latest = oracle.frames.at(-1);
    if (latest.hash !== last.hash) {
      last = latest;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= settleWindowMs) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  throw new Error("paint oracle did not stay stable for the settle window");
}

export async function readLastEnterStamp(page) {
  return page.evaluate(() => {
    const keys = globalThis.__BOTSTER_BASELINE_KEYS__ ?? [];
    return keys.at(-1) ?? null;
  });
}

export function parseWarmupLog(text, ptyClock, marker) {
  const lines = String(text).split("\n").filter((line) => line.length > 0);
  const parsed = lines.map((line) => parseDispatcherLogLine(line, ptyClock));
  const matching = parsed.filter((entry) => entry.ok && entry.marker === marker);
  const expected = ptyClock === "shell_epochrealtime" ? 2 : 1;
  if (matching.length !== expected) {
    return {
      ok: false,
      reason: "warmup_log_wrong_format",
      expected_lines: expected,
      actual_lines: matching.length,
      parsed
    };
  }
  if (ptyClock === "shell_epochrealtime") {
    if (matching[0].post !== false || matching[1].post !== true) {
      return { ok: false, reason: "warmup_log_wrong_format", parsed };
    }
  }
  return { ok: true, parsed: matching };
}

export function appendCostSamples(parsedLines) {
  const samples = [];
  for (let index = 0; index + 1 < parsedLines.length; index += 2) {
    const pre = parsedLines[index];
    const post = parsedLines[index + 1];
    if (!pre?.ok || !post?.ok || post.post !== true || pre.marker !== post.marker) {
      continue;
    }
    samples.push(post.t_pty_ms - pre.t_pty_ms);
  }
  return statisticSet(samples);
}

export async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function workspacePathHasColon(path) {
  return String(path).includes(":");
}

export function fixtureRoot(packageRoot) {
  return join(packageRoot, "fixtures", "terminal-baseline");
}
