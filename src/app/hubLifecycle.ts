/** Hub reconnect hydration and software-update outcome helpers. */

import type { ActionBinding, ActionDispatchResult } from "../botster/actions";
import { hubStatusFamily } from "../botster/connectionDiagnostics";
import type { WebrtcDaemonLifecycleEvent } from "../botster/webrtcDaemonClient";
import { readRecord, readString } from "./values";

export type HubEntityLoadKey =
  | "hubStatus"
  | "app"
  | "packageNavigation"
  | "package"
  | "availablePackage"
  | "spawnTarget"
  | "sessionType"
  | "session";

/**
 * Reconnect hydration is listener-driven per family, deliberately.
 *
 * `EntityFrameStore.replayActivePulls()` exists but has no production caller anywhere in
 * `src/`, so registering a family as an active pull makes it replay-ELIGIBLE without
 * anything replaying it. This function is therefore the sole mechanism keeping hub
 * identity, protocol, and schema facts from regressing after a WebRTC reconnect — the
 * `botster-web.hub_status` registration in the connect chain does not cover it. Removing
 * this listener on the assumption that registered pulls are replayed would silently
 * reintroduce the regression. See [[botster browser pull requests must retry after webrtc
 * reconnect]]; widening it to a generic replay of every family is out of this ticket's scope.
 */
export function replayHubStatusOnLifecycleEvent(
  detail: WebrtcDaemonLifecycleEvent,
  entities: { pull(request: { family: string }): Promise<void> }
): boolean {
  if (detail.type !== "data-channel-open") return false;
  void entities.pull({ family: hubStatusFamily });
  return true;
}

export const hubUpdateCheckActionId = "botster.hub.check_update";

export function hubUpdateCheckAction(): ActionBinding {
  return { id: hubUpdateCheckActionId, label: "Check for updates" };
}

export interface HubUpdateOutcome {
  accepted: boolean;
  update?: Record<string, unknown>;
  reason?: string;
}

/**
 * The update outcome is authored entirely by the accepted action result. A rejected
 * result (offline transport, or a hub operator error) carries no `hub_update`, so no
 * DaemonHubUpdateState is ever synthesized on the client.
 */
export function hubUpdateOutcomeFromResult(result: ActionDispatchResult): HubUpdateOutcome {
  const update = readRecord(readRecord(result.result).hub_update);
  const state = readString(update.state);
  return {
    accepted: result.accepted,
    ...(result.accepted && state ? { update } : {}),
    ...(readString(result.reason) ? { reason: result.reason } : {})
  };
}

export function hubUpdateOutcomeSummary(outcome: HubUpdateOutcome | undefined): string {
  if (!outcome) return "Check whether a newer Hub version is available.";

  const update = readRecord(outcome.update);
  const state = readString(update.state);
  if (!state) {
    return outcome.reason ? `Update check failed: ${outcome.reason}` : "Update check failed.";
  }

  const currentVersion = readString(update.current_version);
  const availableVersion = readString(update.available_version);
  const headline =
    state === "available"
      ? `Update available${availableVersion ? `: ${availableVersion}` : ""}`
      : state === "current"
        ? `Up to date${currentVersion ? `: ${currentVersion}` : ""}`
        : `Updates ${state}`;
  const reason = readString(update.reason);
  return reason ? `${headline} — ${reason}` : headline;
}

/** Diagnostics entity panels show a fixed preview window. */
export const entityFamilyRecordLimit = 4;
