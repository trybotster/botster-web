import { useEffect, useMemo, useRef, useState } from "react";

import {
  DefaultTerminalViewBridge,
  MockTerminalDataPlane,
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
const placeholderCellSize = {
  height: 18,
  width: 9
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
    let observer: ResizeObserver | undefined;
    const resize = () => {
      // Placeholder metrics until the Restty adapter exposes measured cell dimensions.
      const rows = Math.max(4, Math.floor(container.clientHeight / placeholderCellSize.height));
      const columns = Math.max(20, Math.floor(container.clientWidth / placeholderCellSize.width));
      void bridge.resize(descriptor, rows, columns).catch(() => {
        if (!cancelled) {
          container.dataset.terminalResize = "failed";
        }
      });
    };

    void bridge
      .mount(container, descriptor)
      .then(async (nextMount) => {
        mount = nextMount;
        if (cancelled) {
          await bridge.unmount(descriptor, mount);
          return;
        }

        await bridge.attach(descriptor, terminalDataPlane);
        setMountDiagnostic(undefined);
        container.dataset.terminalMount = "mounted";
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container);
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
      observer?.disconnect();
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
      <p className="terminal-status">Restty owns terminal rendering; Botster data-plane attachments own terminal bytes.</p>
      <div
        ref={terminalRef}
        className="terminal-view-container"
        data-terminal-renderer={descriptor.renderer}
        data-terminal-session-id={descriptor.sessionId}
        role="region"
        tabIndex={0}
        onFocus={() => {
          void bridge.focus(descriptor).catch((error: unknown) => {
            const container = terminalRef.current;
            if (container) {
              container.dataset.terminalFocus = "failed";
            }
            onDiagnosticRef.current?.(error);
          });
        }}
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
