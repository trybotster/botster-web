import { useEffect, useMemo, useRef, useState } from "react";

import {
  DefaultTerminalViewBridge,
  MockTerminalDataPlane,
  type TerminalAttachmentStatus,
  type TerminalDataPlaneAttachment,
  type TerminalViewBridge,
  type TerminalViewDescriptor,
  type TerminalViewMount
} from "./terminal";
import { createResttyTerminalRenderer } from "./resttyRenderer";

const defaultBridge = new DefaultTerminalViewBridge(createResttyTerminalRenderer);
const defaultDescriptor: TerminalViewDescriptor = {
  sessionId: "terminal_view_smoke_session",
  renderer: "restty"
};
export interface TerminalViewHostProps {
  bridge?: TerminalViewBridge;
  dataPlane?: TerminalDataPlaneAttachment;
  descriptor?: TerminalViewDescriptor;
  onDiagnostic?: (error: unknown) => void;
}

export function TerminalViewHost({
  bridge = defaultBridge,
  dataPlane,
  descriptor = defaultDescriptor,
  onDiagnostic
}: TerminalViewHostProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const onDiagnosticRef = useRef(onDiagnostic);
  const [mountDiagnostic, setMountDiagnostic] = useState<string | undefined>();
  const [attachmentStatus, setAttachmentStatus] = useState<TerminalAttachmentStatus | undefined>();
  const terminalDataPlane = useMemo(
    () =>
      dataPlane ??
      new MockTerminalDataPlane(descriptor.sessionId, [
        "botster-web terminal_view bridge\r\n",
        "Restty renderer attached through mock terminal data plane.\r\n"
      ]),
    [dataPlane, descriptor.sessionId]
  );

  useEffect(() => {
    onDiagnosticRef.current = onDiagnostic;
  }, [onDiagnostic]);

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    let cancelled = false;
    let mount: TerminalViewMount | undefined;
    let statusSubscription: { unsubscribe(): void } | undefined;
    let uninstallLiveHarnessTerminalControls: (() => void) | undefined;

    void bridge
      .mount(container, descriptor)
      .then(async (nextMount) => {
        mount = nextMount;
        if (cancelled) {
          await bridge.unmount(descriptor, mount);
          return;
        }

        statusSubscription = terminalDataPlane.subscribeStatus?.(setAttachmentStatus);
        await bridge.attach(descriptor, terminalDataPlane);
        uninstallLiveHarnessTerminalControls = installLiveHarnessTerminalControls(bridge, descriptor);
        setMountDiagnostic(undefined);
        container.dataset.terminalMount = "mounted";
      })
      .catch((error: unknown) => {
        container.dataset.terminalMount = "failed";
        container.dataset.terminalMountError =
          error instanceof Error ? error.message : String(error);
        setMountDiagnostic(error instanceof Error ? error.message : String(error));
        onDiagnosticRef.current?.(error);
        if (mount) {
          void bridge.unmount(descriptor, mount);
        }
      });

    return () => {
      cancelled = true;
      statusSubscription?.unsubscribe();
      uninstallLiveHarnessTerminalControls?.();
      if (mount) {
        void bridge.unmount(descriptor, mount);
      }
    };
  }, [bridge, descriptor, terminalDataPlane]);

  return (
    <aside className="terminal-panel" aria-labelledby="terminal-heading">
      <div className="panel-heading">
        <h2 id="terminal-heading">Terminal renderer</h2>
      </div>
      <p
        className="terminal-status"
        data-terminal-attach-state={attachmentStatus?.state ?? "unknown"}
      >
        {attachmentStatus?.message ?? "Restty owns terminal rendering; Botster data-plane attachments own terminal bytes."}
      </p>
      <div
        ref={terminalRef}
        className="terminal-view-container"
        data-terminal-renderer={descriptor.renderer}
        data-terminal-session-id={descriptor.sessionId}
        role="region"
      />
      {mountDiagnostic ? (
        <div className="diagnostic-panel" data-terminal-diagnostic="mount-failed">
          <strong>Terminal renderer unavailable</strong>
          <span>{mountDiagnostic}</span>
        </div>
      ) : null}
    </aside>
  );
}

function installLiveHarnessTerminalControls(
  bridge: TerminalViewBridge,
  descriptor: TerminalViewDescriptor
): () => void {
  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      terminalControl?: {
        focus(): Promise<void>;
        writeInput(data: string): Promise<void>;
        resize(rows: number, columns: number): Promise<void>;
      };
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;

  if (!harness) return () => undefined;

  const terminalControl = {
    focus: () => bridge.focus(descriptor),
    writeInput: (data: string) => bridge.writeInput(descriptor, data),
    resize: (rows: number, columns: number) => bridge.resize(descriptor, rows, columns)
  };
  harness.terminalControl = terminalControl;

  return () => {
    if (harness.terminalControl === terminalControl) {
      delete harness.terminalControl;
    }
  };
}
