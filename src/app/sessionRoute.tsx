/** Terminal session route shell. */

import type { ReactNode } from "react";

export function SessionRouteView({
  sessionId,
  children
}: {
  sessionId: string;
  children: ReactNode;
}) {
  return (
    <section className="terminal-session-view" aria-label={`Terminal session ${sessionId}`} data-testid="terminal-session-view">
      {children}
    </section>
  );
}
