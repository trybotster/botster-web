/** Mount harness for production session-route detach race tests. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EntityFrame, EntityFrameStore } from "../../botster/entities";
import type {
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalSubscription,
  TerminalViewBridge,
  TerminalViewDescriptor,
  TerminalViewMount
} from "../../botster/terminal";
import { TerminalViewHost } from "../../botster/TerminalViewHost";
import {
  isMountedSessionRoute,
  sessionEntityRequiresDetach
} from "../../botster/terminalSession";
import { SessionRouteView } from "../sessionRoute";
import { terminalDescriptorForSessionId } from "../terminalChrome";
import { useSessionEntityDetach } from "../useSessionEntityDetach";

export interface SessionRouteDetachState {
  view: "session" | "dashboard";
  sessionId?: string;
  renderedSessionId?: string;
  requiresDetach: boolean;
  sessionIds: string[];
  sessionTypeIds: string[];
}

export interface SessionRouteDetachApi {
  applyEntityFrame(frame: EntityFrame): void;
  navigateToSession(sessionId: string): void;
  emitProcessExit(sessionId: string): void;
}

export interface SessionDetachTeardownLedger {
  unmounts: string[];
  detaches: string[];
  dataPlaneDetaches: string[];
  statusUnsubscribes: string[];
}

export function createSessionDetachTeardownLedger(): SessionDetachTeardownLedger {
  return {
    unmounts: [],
    detaches: [],
    dataPlaneDetaches: [],
    statusUnsubscribes: []
  };
}

export class SessionDetachTestDataPlane implements TerminalDataPlaneAttachment {
  private readonly statusListeners = new Set<(status: TerminalAttachmentStatus) => void>();

  constructor(
    readonly sessionId: string,
    private readonly ledger: SessionDetachTeardownLedger
  ) {}

  writeInput(): void {}

  subscribeOutput(): TerminalSubscription {
    return { unsubscribe() {} };
  }

  subscribeStatus(listener: (status: TerminalAttachmentStatus) => void): TerminalSubscription {
    this.statusListeners.add(listener);
    listener({
      state: "attached",
      message: "Session detach test data plane attached."
    });
    return {
      unsubscribe: () => {
        this.statusListeners.delete(listener);
        this.ledger.statusUnsubscribes.push(this.sessionId);
      }
    };
  }

  emitProcessExit(): void {
    for (const listener of this.statusListeners) {
      listener({
        state: "exited",
        message: "process exited"
      });
    }
  }

  detach(): void {
    this.ledger.dataPlaneDetaches.push(this.sessionId);
    this.statusListeners.clear();
  }
}

export function createSessionDetachTestBridge(
  ledger: SessionDetachTeardownLedger,
  dataPlanes: Map<string, SessionDetachTestDataPlane>
): TerminalViewBridge {
  return {
    async mount(container: HTMLElement, descriptor: TerminalViewDescriptor): Promise<TerminalViewMount> {
      container.dataset.terminalMount = "mounted";
      container.dataset.terminalSessionId = descriptor.sessionId;
      return { sessionId: descriptor.sessionId, mountId: 1 };
    },
    async unmount(descriptor: TerminalViewDescriptor): Promise<void> {
      ledger.unmounts.push(descriptor.sessionId);
      await this.detach(descriptor);
    },
    async attach(): Promise<void> {},
    async detach(descriptor: TerminalViewDescriptor): Promise<void> {
      ledger.detaches.push(descriptor.sessionId);
      dataPlanes.get(descriptor.sessionId)?.detach();
    },
    async resize(): Promise<void> {},
    async focus(): Promise<void> {},
    async writeInput(): Promise<void> {}
  };
}

export function sessionDetachTestDataPlane(
  sessionId: string,
  ledger: SessionDetachTeardownLedger
): SessionDetachTestDataPlane {
  return new SessionDetachTestDataPlane(sessionId, ledger);
}

export function SessionRouteDetachHarness({
  store,
  initialSessionId,
  dataPlanes,
  bridge,
  onState,
  onReady
}: {
  store: EntityFrameStore;
  initialSessionId?: string;
  dataPlanes: Map<string, SessionDetachTestDataPlane>;
  bridge: TerminalViewBridge;
  onState: (state: SessionRouteDetachState) => void;
  onReady?: (api: SessionRouteDetachApi) => void;
}) {
  const [route, setRoute] = useState<{ view: "session" | "dashboard"; sessionId?: string }>(
    () => initialSessionId
      ? { view: "session", sessionId: initialSessionId }
      : { view: "dashboard" }
  );
  const [revision, setRevision] = useState(0);

  const releaseTerminalSession = useCallback((sessionId: string) => {
    setRoute((current) => {
      if (!isMountedSessionRoute(current, sessionId)) return current;
      return { view: "dashboard" };
    });
  }, []);

  const routeSessionId = route.view === "session" ? route.sessionId : undefined;
  const mountedSessionRecord = routeSessionId
    ? store.get("session", routeSessionId)
    : undefined;
  const frameListeners = useRef(new Set<() => void>());
  const hub = useMemo(() => ({
    onFrame(handler: (frame?: unknown) => void) {
      const listener = () => handler();
      frameListeners.current.add(listener);
      return () => {
        frameListeners.current.delete(listener);
      };
    }
  }), []);
  useSessionEntityDetach(routeSessionId, store, hub, releaseTerminalSession);

  const terminalDescriptor = useMemo(
    () => terminalDescriptorForSessionId(routeSessionId),
    [routeSessionId]
  );
  const terminalDataPlane = routeSessionId ? dataPlanes.get(routeSessionId) : undefined;

  const applyEntityFrame = useCallback((frame: EntityFrame) => {
    store.apply(frame);
    setRevision((current) => current + 1);
    for (const handler of frameListeners.current) {
      handler();
    }
  }, [store]);

  const navigateToSession = useCallback((sessionId: string) => {
    setRoute({ view: "session", sessionId });
  }, []);

  const emitProcessExit = useCallback((sessionId: string) => {
    dataPlanes.get(sessionId)?.emitProcessExit();
  }, [dataPlanes]);

  useEffect(() => {
    onReady?.({
      applyEntityFrame,
      navigateToSession,
      emitProcessExit
    });
  }, [applyEntityFrame, emitProcessExit, navigateToSession, onReady]);

  useEffect(() => {
    onState({
      view: route.view,
      sessionId: route.sessionId,
      renderedSessionId: routeSessionId,
      requiresDetach: sessionEntityRequiresDetach(mountedSessionRecord),
      sessionIds: store.list("session").map((record) => record.id),
      sessionTypeIds: store.list("session_type").map((record) => record.id)
    });
  }, [mountedSessionRecord, onState, revision, route.sessionId, route.view, routeSessionId, store]);

  const terminalPanel = terminalDescriptor && terminalDataPlane ? (
    <TerminalViewHost
      bridge={bridge}
      dataPlane={terminalDataPlane}
      descriptor={terminalDescriptor}
      onExit={releaseTerminalSession}
    />
  ) : null;

  if (route.view === "dashboard") {
    return <section data-testid="dashboard-view" data-revision={revision} />;
  }

  return (
    <SessionRouteView sessionId={route.sessionId ?? ""}>
      {terminalPanel}
    </SessionRouteView>
  );
}
