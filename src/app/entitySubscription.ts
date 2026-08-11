/** Entity subscription frame helpers. */

import type { EntitySubscriptionErrorPayload } from "../botster/protocol";
import { readRecord, readString } from "./values";

/**
 * Hub-reported failure of a held entity subscription, scoped to one family. Rendered
 * verbatim on the owning surface; it never triggers a refetch or a resubscribe.
 */
export function entitySubscriptionErrorFromFrame(
  frame: { kind: string; payload: unknown },
  family: string
): EntitySubscriptionErrorPayload | undefined {
  if (frame.kind !== "entity_error") return undefined;
  const payload = readRecord(frame.payload);
  if (readString(payload.family) !== family) return undefined;
  const code = readString(payload.code);
  const message = readString(payload.message);
  if (!code || !message) return undefined;
  return { family, code, message };
}

export function isEntitySnapshotFrameForFamily(
  frame: { kind: string; payload: unknown },
  family: string
): boolean {
  if (frame.kind !== "entity_snapshot") return false;
  return readString(readRecord(frame.payload).family) === family;
}
