import { useEffect, useMemo, useRef } from "react";

import {
  DefaultTerminalViewBridge,
  MockTerminalDataPlane,
  type TerminalDataPlaneAttachment,
  type TerminalViewBridge,
  type TerminalViewDescriptor
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
}

export function TerminalViewHost({
  bridge = defaultBridge,
  dataPlane,
  descriptor = defaultDescriptor
}: TerminalViewHostProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
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
    const container = terminalRef.current;
    if (!container) return;

    let cancelled = false;
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
      .then(async () => {
        if (cancelled) {
          await bridge.unmount(descriptor);
          return;
        }

        await bridge.attach(descriptor, terminalDataPlane);
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container);
      })
      .catch(() => {
        container.dataset.terminalMount = "failed";
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      void bridge.unmount(descriptor);
    };
  }, [bridge, descriptor, terminalDataPlane]);

  return (
    <aside className="terminal-panel" aria-labelledby="terminal-heading">
      <div className="panel-heading">
        <h2 id="terminal-heading">Terminal renderer</h2>
      </div>
      <div
        ref={terminalRef}
        className="terminal-view-container"
        data-terminal-renderer={descriptor.renderer}
        data-terminal-session-id={descriptor.sessionId}
        role="region"
        tabIndex={0}
        onFocus={() => {
          void bridge.focus(descriptor);
        }}
      />
    </aside>
  );
}
