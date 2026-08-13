/** Action-result toast copy for package, plugin, spawn, and session-type operations. */

import type { UiActionResult } from "@trybotster/ui-contract";

import { actionLabelFromId, readDiagnosticMessage, readRecord, readString } from "./values";

export type ActionToast = { message: string; color: string };

export function packageActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): { message: string; color: string } {
  const payload = readRecord(result.result);
  const requestType = readString(payload.request_type) ?? "package action";
  const decision = readRecord(payload.package_decision);
  const installPlan = readRecord(payload.install_plan);
  const updateStatus = readRecord(payload.update_status);
  const diagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics.map(readDiagnosticMessage).filter(Boolean) : [];

  if (!result.accepted) {
    return {
      message: result.reason ?? `${actionLabelFromId(requestType)} failed`,
      color: "danger"
    };
  }

  const decisionPackage = readString(decision.package_name);
  const decisionAction = readString(decision.action);
  const decisionState = readString(decision.state);
  if (decisionPackage) {
    return {
      message: `${decisionPackage}: ${actionLabelFromId(decisionAction ?? requestType)}${decisionState ? ` (${decisionState})` : ""}`,
      color: "success"
    };
  }

  const installEntry = readRecord(installPlan.entry);
  const installPackage = readString(installEntry.package_name);
  const installEffects = Array.isArray(installPlan.effects)
    ? installPlan.effects.map((effect) => readString(readRecord(effect).message)).filter(Boolean)
    : [];
  if (installPackage) {
    return {
      message: `${installPackage}: ${installEffects[0] ?? "Install plan received"}`,
      color: "success"
    };
  }

  const updatePackage = readString(updateStatus.package_name);
  if (updatePackage) {
    return {
      message: `${updatePackage}: ${updateStatus.update_available === true ? "Update available" : "No update available"}`,
      color: "success"
    };
  }

  return {
    message: diagnostics[0] ?? `${actionLabelFromId(requestType)} accepted`,
    color: "success"
  };
}

export function pluginActionResultFeedback(result: UiActionResult): ActionToast | undefined {
  const formErrors = result.form_errors?.filter((message) => message.trim()) ?? [];
  if (result.state === "rejected" || result.state === "error") {
    return {
      message: formErrors.join(" ") || result.error || `${actionLabelFromId(result.action_id)} ${result.state}`,
      color: "danger"
    };
  }

  const warnings = result.warnings?.filter((message) => message.trim()) ?? [];
  if (warnings.length > 0) {
    return {
      message: warnings.join(" "),
      color: "warning"
    };
  }

  return undefined;
}

export function pluginSurfaceActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): ActionToast | undefined {
  const payload = readRecord(result.result);
  const pluginActionResult = readRecord(payload.plugin_action_result);
  const packageName = readString(payload.package_name);
  const surfaceId = readString(payload.surface_id);
  const actionId = readString(payload.action_id);
  if (!packageName || !surfaceId || !actionId || Object.keys(pluginActionResult).length === 0) return undefined;

  if (!result.accepted) {
    return {
      message: result.reason ?? readString(pluginActionResult.error) ?? `${actionLabelFromId(actionId)} failed`,
      color: "danger"
    };
  }

  return pluginActionResultFeedback(pluginActionResult as unknown as UiActionResult);
}

export function spawnTargetActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): { message: string; color: string } | undefined {
  const payload = readRecord(result.result);
  const requestType = readString(payload.request_type);
  if (!requestType?.includes("spawn_target")) return undefined;
  const actionLabel = actionLabelFromId(requestType).replace("Spawn Target", "Spawn Point");

  if (!result.accepted) {
    return {
      message: result.reason ?? `${actionLabel} failed`,
      color: "danger"
    };
  }

  const targets = Array.isArray(payload.spawn_targets) ? payload.spawn_targets : [];
  const target = readRecord(targets[0]);
  const targetId = readString(target.target_id) ?? readString(payload.target_id);
  return {
    message: targetId ? `${targetId}: ${actionLabel}` : `${actionLabel} accepted`,
    color: "success"
  };
}


export function sessionTypeActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): { message: string; color: string } | undefined {
  const payload = readRecord(result.result);
  const requestType = readString(payload.request_type);
  if (!requestType?.includes("session_type")) return undefined;

  return {
    message: result.accepted
      ? `${actionLabelFromId(requestType)} accepted`
      : result.reason ?? `${actionLabelFromId(requestType)} failed`,
    color: result.accepted ? "success" : "danger"
  };
}
