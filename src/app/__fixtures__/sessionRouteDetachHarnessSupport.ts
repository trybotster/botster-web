/** Test doubles for the session-route detach harness (no components, so Fast Refresh stays exact). */

import type {
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalInputOutcome,
  TerminalSubscription,
  TerminalViewBridge,
  TerminalViewDescriptor,
  TerminalViewMount
} from "../../botster/terminal";

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

  sendInput(): void {}

  async writePaste(text: string): Promise<TerminalInputOutcome> {
    return {
      kind: "paste",
      outcome: "rejected_locally",
      requestedBytes: text.length,
      reason: "test_data_plane",
      detail: "Session detach test data plane does not deliver paste."
    };
  }

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
    async writeRawInput(): Promise<void> {}
  };
}

export function sessionDetachTestDataPlane(
  sessionId: string,
  ledger: SessionDetachTeardownLedger
): SessionDetachTestDataPlane {
  return new SessionDetachTestDataPlane(sessionId, ledger);
}
