export const FORMAT_VERSION = 1;
export const VERSION_TOKEN = "terminal_baseline_observation_format=1";
export const PAINT_ORACLE = "cdp_screencast";
export const PTY_CLOCKS = Object.freeze(["shell_epochrealtime", "host_watcher"]);
export const ARM_IDS = Object.freeze(["legacy", "modular"]);

export const PRODUCT_BASELINE_STATEMENT =
  "This is a product baseline, not a transport-causality experiment. " +
  "The two arms differ in Hub, Core, client, and Lua runtime at once. " +
  "No row of this baseline may be read as evidence that any single component caused a difference.";

export const FROZEN_INPUTS = Object.freeze({
  viewport: Object.freeze({ width: 1440, height: 900, device_scale_factor: 1 }),
  terminal_geometry: Object.freeze({ rows: 32, cols: 120 }),
  measured_repetitions: 20,
  warmup_repetitions: 3,
  settle_window_ms: 250,
  handshake_band_ms: 2000,
  history_line_count: 400,
  history_line_bytes: 80,
  sibling_flood_bytes: 262144,
  scroll_delta_y: 120,
  scroll_event_count: 8,
  scroll_pacing_ms: 16,
  package_event_burst_count: 200,
  control_request_names: Object.freeze(["list_configs", "list_session_types"]),
  control_request_count: 20,
  screencast: Object.freeze({
    format: "png",
    max_width: 1440,
    max_height: 900
  }),
  teardown_budget_ms: 10_000,
  teardown_escalate_ms: 2_000,
  probe_prefix: "botster-baseline-probe:",
  paint_prefix: "botster-baseline-paint:",
  ready_token: "botster-baseline-ready",
  exit_token: "botster-baseline-exit"
});

export const PINNED_REVISIONS = Object.freeze({
  modular_hub: "f6db5c436f72b151fd6dacde61d3f4836a4dc925",
  modular_web: "bcf89f1102b8adf333cd93edb09274e04dab22eb",
  modular_core: "7eafa470a18025895995bbedc20d34b58106a03b",
  modular_restty: "59c640488f33b10296875471691e43da6890e074",
  modular_ghostty: "eb72ec61304ea256be1d86ed8fa961c84e43ecbd",
  modular_restty_declaration_source: "src/vendor/restty/README.md",
  legacy_monorepo: "f598075e6c143ef14b34d3a3dffdf2ec6a8d9eb6",
  legacy_restty: "cd1911d0f88606270b1457c6995a3c04cb497edf",
  legacy_restty_declaration_source: "2b52d0c9",
  legacy_restty_short: "cd1911d0f"
});

export const OBSERVATION_FAMILIES = Object.freeze([
  "key_to_pty",
  "attach_ready",
  "history_finish",
  "scrollback",
  "large_history",
  "control_response_saturation",
  "package_event_saturation",
  "sibling_saturation"
]);

export const FAMILY_CONTRACTS = Object.freeze({
  key_to_pty: Object.freeze({
    endpoint_start: "t_key",
    endpoint_end: "t_pty",
    oracle: "pty"
  }),
  attach_ready: Object.freeze({
    endpoint_start: "attach_begin",
    endpoint_end: "first_paint_after_attach",
    oracle: "paint"
  }),
  history_finish: Object.freeze({
    endpoint_start: "first_paint_after_attach",
    endpoint_end: "paint_settled",
    oracle: "paint"
  }),
  scrollback: Object.freeze({
    endpoint_start: "first_wheel_dispatch",
    endpoint_end: "paint_settled",
    oracle: "paint"
  }),
  large_history: Object.freeze({
    endpoint_start: "large_history_attach",
    endpoint_end: "paint_settled",
    oracle: "paint"
  }),
  control_response_saturation: Object.freeze({
    endpoint_start: "t_key",
    endpoint_end: "t_pty",
    oracle: "pty"
  }),
  package_event_saturation: Object.freeze({
    endpoint_start: "t_key",
    endpoint_end: "t_pty",
    oracle: "pty"
  }),
  sibling_saturation: Object.freeze({
    endpoint_start: "t_key_terminal_b",
    endpoint_end: "t_pty_terminal_b",
    oracle: "pty"
  })
});

const REQUIRED_TOP_LEVEL = Object.freeze([
  "format_version",
  "capture_id",
  "product_baseline_only",
  "product_baseline_statement",
  "same_host",
  "paint_oracle",
  "pty_clock",
  "host",
  "browser",
  "arms",
  "frozen_inputs",
  "observations",
  "correctness",
  "blocked"
]);

const REQUIRED_HOST = Object.freeze([
  "os",
  "kernel",
  "cpu_model",
  "logical_cpu_count",
  "memory_bytes",
  "runner_label"
]);

const REQUIRED_BROWSER = Object.freeze([
  "playwright_channel",
  "chromium_revision",
  "viewport",
  "device_scale_factor"
]);

const REQUIRED_ARM = Object.freeze([
  "arm_id",
  "revisions",
  "build_commands",
  "launch_command",
  "binary_real_paths",
  "client",
  "restty",
  "env",
  "terminal_bounding_box",
  "frame_scale",
  "discarded_frame_count"
]);

const REQUIRED_RESTTY = Object.freeze([
  "declared_revision",
  "declaration_source",
  "artifact_sha256",
  "ghostty_pin"
]);

const REQUIRED_FAMILY_STATS = Object.freeze([
  "endpoint_start",
  "endpoint_end",
  "oracle",
  "unit",
  "n",
  "warmup_discarded",
  "min",
  "p50",
  "p95",
  "max"
]);

const FORBIDDEN_THRESHOLD_KEYS = Object.freeze([
  "threshold",
  "threshold_ms",
  "budget_ms",
  "sla_ms",
  "gate_ms",
  "max_allowed_ms"
]);

const FULL_REVISION = /^[0-9a-f]{40}$/;
const HANDSHAKE_FIELD = /^[0-9]{10}\.[0-9]{6}$/;

export function percentile(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) {
    return null;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function statisticSet(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return {
      n: 0,
      min: null,
      p50: null,
      p95: null,
      max: null
    };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1]
  };
}

export function notApplicableFamily(reason) {
  return {
    status: "not_applicable",
    reason
  };
}

export function parseHandshakeLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty_handshake", raw: trimmed, fields: [] };
  }
  const fields = trimmed.split(/\s+/);
  return { ok: fields.length === 2, raw: trimmed, fields };
}

export function acceptShellClockHandshake(line, hostDateNow, bandMs = FROZEN_INPUTS.handshake_band_ms) {
  const parsed = parseHandshakeLine(line);
  if (!parsed.ok || parsed.fields.length !== 2) {
    return {
      accepted: false,
      pty_clock: "host_watcher",
      reason: parsed.reason ?? "handshake_shape",
      raw: parsed.raw,
      checks: { shape: false, advances: false, tracks_host: false }
    };
  }
  const [first, second] = parsed.fields;
  const shape = HANDSHAKE_FIELD.test(first) && HANDSHAKE_FIELD.test(second);
  const firstMs = Number.parseFloat(first) * 1000;
  const secondMs = Number.parseFloat(second) * 1000;
  const advances = shape && Number.isFinite(firstMs) && Number.isFinite(secondMs) && secondMs >= firstMs && first !== second;
  const tracksHost = shape
    && Math.abs(firstMs - hostDateNow) <= bandMs
    && Math.abs(secondMs - hostDateNow) <= bandMs;
  const accepted = shape && advances && tracksHost;
  return {
    accepted,
    pty_clock: accepted ? "shell_epochrealtime" : "host_watcher",
    reason: accepted ? null : "handshake_rejected",
    raw: parsed.raw,
    checks: { shape, advances, tracks_host: tracksHost },
    fields: parsed.fields
  };
}

export function negotiateCaptureClock(legacyResult, modularResult) {
  if (legacyResult?.accepted && modularResult?.accepted) {
    return "shell_epochrealtime";
  }
  return "host_watcher";
}

export function parseDispatcherLogLine(line, ptyClock) {
  const trimmed = String(line ?? "").replace(/\r$/, "");
  if (ptyClock === "shell_epochrealtime") {
    const match = trimmed.match(/^([0-9]{10}\.[0-9]{6}) (\S+)(?: (post))?$/);
    if (!match) {
      return { ok: false, reason: "wrong_format", raw: trimmed };
    }
    return {
      ok: true,
      epoch_seconds: match[1],
      t_pty_ms: Number.parseFloat(match[1]) * 1000,
      marker: match[2],
      post: match[3] === "post",
      raw: trimmed
    };
  }
  if (!trimmed || /\s/.test(trimmed)) {
    return { ok: false, reason: "wrong_format", raw: trimmed };
  }
  return { ok: true, marker: trimmed, raw: trimmed };
}

export function mapCssBoxToFramePixels(box, metadata, scale) {
  const pageScale = metadata.pageScaleFactor ?? 1;
  const scrollX = metadata.scrollOffsetX ?? 0;
  const scrollY = metadata.scrollOffsetY ?? 0;
  const offsetTop = metadata.offsetTop ?? 0;
  return {
    x: (box.x - scrollX) * pageScale * scale,
    y: ((box.y - scrollY) * pageScale + offsetTop) * scale,
    width: box.width * pageScale * scale,
    height: box.height * pageScale * scale
  };
}

export function measureFrameScale(encodedFrameWidth, deviceWidth) {
  if (!Number.isFinite(encodedFrameWidth) || !Number.isFinite(deviceWidth) || deviceWidth === 0) {
    throw new Error("frame scale requires encodedFrameWidth and a nonzero deviceWidth");
  }
  return encodedFrameWidth / deviceWidth;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectThresholdKeys(value, path, found) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectThresholdKeys(entry, `${path}[${index}]`, found));
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_THRESHOLD_KEYS.includes(key)) {
      found.push(`${path}.${key}`);
    }
    collectThresholdKeys(child, path ? `${path}.${key}` : key, found);
  }
}

function requireKeys(object, keys, label, errors) {
  if (!isObject(object)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of keys) {
    if (!Object.hasOwn(object, key)) {
      errors.push(`${label} is missing ${key}`);
    }
  }
}

function validateRestty(restty, armId, errors) {
  requireKeys(restty, REQUIRED_RESTTY, `arms.${armId}.restty`, errors);
  if (!isObject(restty)) {
    return;
  }
  if (typeof restty.declared_revision !== "string" || !FULL_REVISION.test(restty.declared_revision)) {
    errors.push(`arms.${armId}.restty.declared_revision must be a full 40-character commit`);
  }
  if (typeof restty.declaration_source !== "string" || restty.declaration_source.length === 0) {
    errors.push(`arms.${armId}.restty.declaration_source is required`);
  }
  if (!isObject(restty.artifact_sha256) || Object.keys(restty.artifact_sha256).length === 0) {
    errors.push(`arms.${armId}.restty.artifact_sha256 must name every loaded Restty file`);
  } else {
    for (const [file, digest] of Object.entries(restty.artifact_sha256)) {
      if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
        errors.push(`arms.${armId}.restty.artifact_sha256.${file} must be a sha256 hex digest`);
      }
    }
  }
  const pin = restty.ghostty_pin;
  if (pin !== null && (typeof pin !== "object" || typeof pin.commit !== "string" || !FULL_REVISION.test(pin.commit))) {
    errors.push(`arms.${armId}.restty.ghostty_pin must be null with a reason or { commit, reason? }`);
  }
  if (pin === null && (typeof restty.ghostty_pin_reason !== "string" || restty.ghostty_pin_reason.length === 0)) {
    errors.push(`arms.${armId}.restty.ghostty_pin_reason is required when ghostty_pin is null`);
  }
}

function validateFamily(family, name, armId, ptyClock, errors) {
  const label = `observations.${armId}.${name}`;
  if (!isObject(family)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (family.status === "not_applicable") {
    if (typeof family.reason !== "string" || family.reason.length === 0) {
      errors.push(`${label} not_applicable requires a reason`);
    }
    if (["min", "p50", "p95", "max", "n"].some((key) => family[key] != null && key !== "reason")) {
      if (family.n != null || family.min != null || family.p50 != null) {
        errors.push(`${label} not_applicable must not carry a number`);
      }
    }
    return;
  }
  if (family.status === "blocked") {
    if (typeof family.reason !== "string" || family.reason.length === 0) {
      errors.push(`${label} blocked requires a typed reason`);
    }
    return;
  }
  requireKeys(family, REQUIRED_FAMILY_STATS, label, errors);
  const contract = FAMILY_CONTRACTS[name];
  if (family.oracle !== contract.oracle) {
    errors.push(`${label}.oracle must be ${contract.oracle}`);
  }
  if (family.unit !== "ms") {
    errors.push(`${label}.unit must be ms`);
  }
  if (name === "key_to_pty") {
    if (typeof family.decomposition_valid !== "boolean") {
      errors.push(`${label}.decomposition_valid is required`);
    } else if (ptyClock === "shell_epochrealtime" && family.decomposition_valid !== true) {
      errors.push(`${label}.decomposition_valid must be true under shell_epochrealtime`);
    } else if (ptyClock === "host_watcher" && family.decomposition_valid !== false) {
      errors.push(`${label}.decomposition_valid must be false under host_watcher`);
    }
    if (ptyClock === "host_watcher" && family.discarded_negative_pty_to_paint === true) {
      errors.push(`${label} must record negative pty_to_paint_ms rather than discard them`);
    }
  }
}

export function validateObservationRecord(record) {
  const errors = [];
  if (!isObject(record)) {
    return { ok: false, errors: ["record must be an object"] };
  }
  requireKeys(record, REQUIRED_TOP_LEVEL, "record", errors);
  if (record.format_version !== FORMAT_VERSION) {
    errors.push("format_version must be 1");
  }
  if (typeof record.capture_id !== "string" || record.capture_id.length === 0) {
    errors.push("capture_id is required");
  }
  if (record.product_baseline_only !== true) {
    errors.push("product_baseline_only must be true");
  }
  if (record.product_baseline_statement !== PRODUCT_BASELINE_STATEMENT) {
    errors.push("product_baseline_statement must carry the section 4 causality statement");
  }
  if (record.same_host !== true) {
    errors.push("same_host must be true");
  }
  if (record.paint_oracle !== PAINT_ORACLE) {
    errors.push("paint_oracle must be cdp_screencast");
  }
  if (!PTY_CLOCKS.includes(record.pty_clock)) {
    errors.push("pty_clock must be shell_epochrealtime or host_watcher");
  }
  requireKeys(record.host, REQUIRED_HOST, "host", errors);
  requireKeys(record.browser, REQUIRED_BROWSER, "browser", errors);
  if (!isObject(record.arms) || ARM_IDS.some((armId) => !isObject(record.arms[armId]))) {
    errors.push("arms must contain exactly legacy and modular objects");
  } else {
    const extraArms = Object.keys(record.arms).filter((armId) => !ARM_IDS.includes(armId));
    if (extraArms.length > 0) {
      errors.push(`arms contains unexpected entries: ${extraArms.join(", ")}`);
    }
    if (Object.keys(record.arms).length !== 2) {
      errors.push("a one-armed record is not a baseline");
    }
    for (const armId of ARM_IDS) {
      const arm = record.arms[armId];
      requireKeys(arm, REQUIRED_ARM, `arms.${armId}`, errors);
      if (arm?.arm_id !== armId) {
        errors.push(`arms.${armId}.arm_id must equal ${armId}`);
      }
      validateRestty(arm?.restty, armId, errors);
      if (arm?.implied_pty_clock && arm.implied_pty_clock !== record.pty_clock) {
        errors.push(`arms.${armId} implies a different pty_clock than the capture`);
      }
    }
  }
  if (!isObject(record.observations)) {
    errors.push("observations must be an object");
  } else {
    for (const armId of ARM_IDS) {
      const armObs = record.observations[armId];
      if (!isObject(armObs)) {
        errors.push(`observations.${armId} must be an object`);
        continue;
      }
      for (const name of OBSERVATION_FAMILIES) {
        validateFamily(armObs[name], name, armId, record.pty_clock, errors);
      }
    }
  }
  if (!Array.isArray(record.blocked)) {
    errors.push("blocked must be an array");
  }
  const thresholdKeys = [];
  collectThresholdKeys(record, "record", thresholdKeys);
  for (const path of thresholdKeys) {
    errors.push(`record carries a threshold field at ${path}`);
  }
  if (record.pty_clock === "shell_epochrealtime") {
    for (const armId of ARM_IDS) {
      const keyFamily = record.observations?.[armId]?.key_to_pty;
      if (isObject(keyFamily) && keyFamily.status !== "not_applicable" && keyFamily.status !== "blocked") {
        if (!isObject(keyFamily.append_cost_calibration_ms) || keyFamily.append_cost_calibration_ms.n === 0) {
          errors.push(`observations.${armId}.key_to_pty.append_cost_calibration_ms is required under shell_epochrealtime`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function assertValidObservationRecord(record) {
  const result = validateObservationRecord(record);
  if (!result.ok) {
    throw new Error(`terminal baseline record is invalid:\n${result.errors.join("\n")}`);
  }
  return result;
}

function measuredFamily(name, extras = {}) {
  const contract = FAMILY_CONTRACTS[name];
  return {
    endpoint_start: contract.endpoint_start,
    endpoint_end: contract.endpoint_end,
    oracle: contract.oracle,
    unit: "ms",
    n: 20,
    warmup_discarded: 3,
    min: 1,
    p50: 2,
    p95: 3,
    max: 4,
    ...extras
  };
}

export function exampleValidRecord(overrides = {}) {
  const ptyClock = overrides.pty_clock ?? "shell_epochrealtime";
  const restty = (armId) => ({
    declared_revision: armId === "modular" ? PINNED_REVISIONS.modular_restty : PINNED_REVISIONS.legacy_restty,
    declaration_source: armId === "modular"
      ? PINNED_REVISIONS.modular_restty_declaration_source
      : PINNED_REVISIONS.legacy_restty_declaration_source,
    artifact_sha256: {
      "restty.js": "a".repeat(64)
    },
    ghostty_pin: armId === "modular"
      ? { commit: PINNED_REVISIONS.modular_ghostty }
      : null,
    ghostty_pin_reason: armId === "modular" ? undefined : "legacy f598075e declares no Ghostty pin"
  });
  const arm = (armId) => ({
    arm_id: armId,
    revisions: { commit: "b".repeat(40) },
    build_commands: ["cargo build"],
    launch_command: "hub start",
    binary_real_paths: {},
    client: armId,
    restty: restty(armId),
    env: {},
    terminal_bounding_box: { x: 0, y: 0, width: 800, height: 400 },
    frame_scale: 1,
    discarded_frame_count: 0
  });
  const observations = (armId) => ({
    key_to_pty: measuredFamily("key_to_pty", {
      decomposition_valid: ptyClock === "shell_epochrealtime",
      discarded_negative_pty_to_paint: false,
      pty_to_paint_ms: statisticSet([1, 2, 3]),
      key_to_paint_ms: statisticSet([2, 3, 4]),
      append_cost_calibration_ms: ptyClock === "shell_epochrealtime" ? statisticSet([0.2, 0.3]) : undefined,
      watcher_detection_calibration_ms: ptyClock === "host_watcher" ? statisticSet([1, 2]) : undefined
    }),
    attach_ready: measuredFamily("attach_ready"),
    history_finish: measuredFamily("history_finish", {
      arm_local_semantics: armId === "modular" ? { ghostsnp_ready: true, ghostsnp_finish: true } : null
    }),
    scrollback: measuredFamily("scrollback"),
    large_history: measuredFamily("large_history"),
    control_response_saturation: measuredFamily("control_response_saturation"),
    package_event_saturation: armId === "legacy"
      ? notApplicableFamily("legacy f598075e has no harness-drivable package-event plane")
      : measuredFamily("package_event_saturation"),
    sibling_saturation: measuredFamily("sibling_saturation")
  });
  return {
    format_version: FORMAT_VERSION,
    capture_id: "example-capture",
    product_baseline_only: true,
    product_baseline_statement: PRODUCT_BASELINE_STATEMENT,
    same_host: true,
    paint_oracle: PAINT_ORACLE,
    pty_clock: ptyClock,
    host: {
      os: "darwin",
      kernel: "25.5.0",
      cpu_model: "test",
      logical_cpu_count: 8,
      memory_bytes: 1,
      runner_label: "local"
    },
    browser: {
      playwright_channel: "chromium",
      chromium_revision: "1.60.0",
      viewport: FROZEN_INPUTS.viewport,
      device_scale_factor: 1
    },
    arms: {
      legacy: arm("legacy"),
      modular: arm("modular")
    },
    frozen_inputs: FROZEN_INPUTS,
    observations: {
      legacy: observations("legacy"),
      modular: observations("modular")
    },
    correctness: { legacy: {}, modular: {} },
    blocked: [],
    ...overrides
  };
}
