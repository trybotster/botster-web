import { useEffect, useMemo, useRef, useState } from "react";

import {
  DefaultTerminalViewBridge,
  MockTerminalDataPlane,
  type TerminalAttachmentStatus,
  type TerminalDataPlaneAttachment,
  type TerminalInputOutcome,
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
  onAttachmentStatus?: (sessionId: string, status: TerminalAttachmentStatus) => void;
  onDiagnostic?: (error: unknown) => void;
  /** Explicit input operation outcomes (paste), including successes. */
  onInputOutcome?: (sessionId: string, outcome: TerminalInputOutcome) => void;
  onExit?: (sessionId: string) => void;
}

export function TerminalViewHost({
  bridge = defaultBridge,
  dataPlane,
  descriptor = defaultDescriptor,
  onAttachmentStatus,
  onDiagnostic,
  onInputOutcome,
  onExit
}: TerminalViewHostProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const onAttachmentStatusRef = useRef(onAttachmentStatus);
  const onDiagnosticRef = useRef(onDiagnostic);
  const onInputOutcomeRef = useRef(onInputOutcome);
  const onExitRef = useRef(onExit);
  const [mountDiagnostic, setMountDiagnostic] = useState<string | undefined>();
  const [attachmentStatus, setAttachmentStatus] = useState<TerminalAttachmentStatus | undefined>();
  // Persistent input message: a non-admitted paste outcome stays visible until the user
  // dismisses it or a later paste is admitted. Attachment lifecycle is not involved.
  const [inputMessage, setInputMessage] = useState<TerminalInputOutcome | undefined>();
  const terminalDataPlane = useMemo(
    () =>
      dataPlane ??
      new MockTerminalDataPlane(descriptor.sessionId, [
        new TextEncoder().encode("botster-web terminal_view bridge\r\n"),
        new TextEncoder().encode("Restty renderer attached through mock terminal data plane.\r\n")
      ]),
    [dataPlane, descriptor.sessionId]
  );

  useEffect(() => {
    onAttachmentStatusRef.current = onAttachmentStatus;
  }, [onAttachmentStatus]);

  useEffect(() => {
    onDiagnosticRef.current = onDiagnostic;
  }, [onDiagnostic]);

  useEffect(() => {
    onInputOutcomeRef.current = onInputOutcome;
  }, [onInputOutcome]);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    let cancelled = false;
    let mount: TerminalViewMount | undefined;
    let statusSubscription: { unsubscribe(): void } | undefined;
    let inputOutcomeSubscription: { unsubscribe(): void } | undefined;
    // A replacement session starts without the previous session's input message.
    setInputMessage(undefined);
    let uninstallLiveHarnessTerminalControls: (() => void) | undefined;
    let exitReported = false;

    void bridge
      .mount(container, descriptor)
      .then(async (nextMount) => {
        mount = nextMount;
        if (cancelled) {
          await bridge.unmount(descriptor, mount).catch(() => undefined);
          return;
        }

        statusSubscription = terminalDataPlane.subscribeStatus?.((status) => {
          setAttachmentStatus(status);
          onAttachmentStatusRef.current?.(descriptor.sessionId, status);
          if (status.state === "exited" && !exitReported) {
            exitReported = true;
            onExitRef.current?.(descriptor.sessionId);
          }
        });
        await bridge.attach(descriptor, terminalDataPlane);
        // Cleanup may have run during attach. Fence before installing anything cleanup
        // would otherwise never remove. Release ownership before unsubscribing so a
        // subscription is released exactly once by whichever owner reaches it first.
        if (cancelled) {
          const released = statusSubscription;
          statusSubscription = undefined;
          released?.unsubscribe();
          return;
        }
        inputOutcomeSubscription = bridge.subscribeInputOutcomes?.(descriptor, (outcome) => {
          if (cancelled) return;
          setInputMessage(outcome.outcome === "admitted" ? undefined : outcome);
          onInputOutcomeRef.current?.(descriptor.sessionId, outcome);
        });
        uninstallLiveHarnessTerminalControls = installLiveHarnessTerminalControls(bridge, descriptor, terminalDataPlane);
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
          void bridge.unmount(descriptor, mount).catch(() => undefined);
        }
      });

    return () => {
      cancelled = true;
      // Take each reference and clear it before releasing, so the fenced continuation and
      // a reentrant cleanup cannot release the same subscription twice.
      const releasedStatus = statusSubscription;
      statusSubscription = undefined;
      releasedStatus?.unsubscribe();
      const releasedOutcomes = inputOutcomeSubscription;
      inputOutcomeSubscription = undefined;
      releasedOutcomes?.unsubscribe();
      uninstallLiveHarnessTerminalControls?.();
      if (mount) {
        void bridge.unmount(descriptor, mount).catch(() => undefined);
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
      {inputMessage ? (
        <div
          className="terminal-input-message"
          role="status"
          data-terminal-input-kind={inputMessage.kind}
          data-terminal-input-outcome={inputMessage.outcome}
        >
          <span>{terminalInputMessage(inputMessage)}</span>
          <button
            type="button"
            aria-label="Dismiss terminal input message"
            onClick={() => setInputMessage(undefined)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
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
  descriptor: TerminalViewDescriptor,
  dataPlane: TerminalDataPlaneAttachment
): () => void {
  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      terminalControl?: {
        focus(): Promise<void>;
        writeInput(data: string): Promise<void>;
        resize(rows: number, columns: number): Promise<void>;
        readScreen(): ReturnType<NonNullable<TerminalDataPlaneAttachment["readScreen"]>>;
        captureSnapshot(): ReturnType<NonNullable<TerminalDataPlaneAttachment["captureSnapshot"]>>;
      };
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;

  if (!harness) return () => undefined;

  const terminalControl = {
    focus: () => bridge.focus(descriptor),
    writeInput: (data: string) => bridge.writeInput(descriptor, data),
    resize: (rows: number, columns: number) => bridge.resize(descriptor, rows, columns),
    readScreen: async () => dataPlane.readScreen?.(),
    captureSnapshot: async () => dataPlane.captureSnapshot?.()
  };
  harness.terminalControl = terminalControl;

  return () => {
    if (harness.terminalControl === terminalControl) {
      delete harness.terminalControl;
    }
  };
}

/** User-visible text for a non-admitted input outcome; the three cases stay distinct. */
export function terminalInputSize(outcome: TerminalInputOutcome): string {
  return outcome.requestedBytes !== undefined
    ? `${outcome.requestedBytes} bytes`
    : `at least ${outcome.minimumBytes} bytes`;
}

export function terminalInputMessage(outcome: TerminalInputOutcome): string {
  switch (outcome.outcome) {
    case "rejected":
      return `Paste rejected (${outcome.reason}): ${outcome.detail}`;
    case "partial":
      return `Paste partially delivered (${outcome.deliveredBytes} of ${terminalInputSize(outcome)}): ${outcome.detail}`;
    case "cancelled":
      return `Paste cancelled before delivery: ${outcome.detail}`;
    case "unknown":
      return `Paste delivery unknown: ${outcome.detail}`;
    case "admitted":
      return outcome.detail;
  }
}
