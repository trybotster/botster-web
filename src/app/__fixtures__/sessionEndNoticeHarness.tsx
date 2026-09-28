/** Mount harness for production useSessionEndNotice tests. */

import type { TerminalAttachmentStatus } from "../../botster/terminal";
import { useSessionEndNotice } from "../useSessionEndNotice";

export function SessionEndNoticeHarness(props: {
  entities: {
    get(family: string, id: string): Record<string, unknown> | undefined;
    list(family: string): Record<string, unknown>[];
  };
  hub: { onFrame(handler: (frame?: unknown) => void): () => void };
  showToast: (toast: { message: string; color: string }) => void;
  onRelease: (release: (sessionId: string, status?: TerminalAttachmentStatus) => unknown) => void;
}) {
  const { release } = useSessionEndNotice({ entities: props.entities, hub: props.hub, showToast: props.showToast });
  props.onRelease(release);
  return null;
}
