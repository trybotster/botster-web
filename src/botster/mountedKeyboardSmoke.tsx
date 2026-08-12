import { createRoot } from "react-dom/client";

import { TerminalViewHost } from "./TerminalViewHost";
import type {
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalOutput,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";

const descriptor: TerminalViewDescriptor = {
  sessionId: "mounted_keyboard_smoke_session",
  renderer: "restty"
};

const readyOutput = "botster-web-mounted-keyboard-ready\r\n";
const echoPrefix = "botster-web-mounted-keyboard-echo:";
const outputListeners = new Set<(data: TerminalOutput) => void>();
const statusListeners = new Set<(status: TerminalAttachmentStatus) => void>();

type MountedKeyboardHarness = {
  callbackOrder: string[];
  emitOutput(data: string | Uint8Array): void;
  emitStatus(status: TerminalAttachmentStatus): void;
  exitSessions: string[];
  inputs: string[];
  statuses: Array<{ sessionId: string; state: TerminalAttachmentStatus["state"] }>;
  terminal: Array<{ kind: string; payload: unknown }>;
  outputSubscribers: number;
};

const harness: MountedKeyboardHarness = {
  callbackOrder: [],
  emitOutput(data) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    for (const listener of outputListeners) {
      listener(bytes);
    }
    harness.callbackOrder.push(`output:${new TextDecoder().decode(bytes)}`);
  },
  emitStatus(status) {
    for (const listener of statusListeners) {
      listener(status);
    }
  },
  exitSessions: [],
  inputs: [],
  statuses: [],
  terminal: [],
  outputSubscribers: 0
};

(window as typeof window & {
  __BOTSTER_MOUNTED_KEYBOARD_SMOKE__?: MountedKeyboardHarness;
  __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
    events: unknown[];
    terminal: Array<{ kind: string; payload: unknown }>;
  };
}).__BOTSTER_MOUNTED_KEYBOARD_SMOKE__ = harness;

(window as typeof window & {
  __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
    events: unknown[];
    terminal: Array<{ kind: string; payload: unknown }>;
  };
}).__BOTSTER_LIVE_PROTOCOL_HARNESS__ = {
  events: [],
  terminal: harness.terminal
};

const dataPlane: TerminalDataPlaneAttachment = {
  sessionId: descriptor.sessionId,
  writeInput(data) {
    harness.inputs.push(data);
    const output = new TextEncoder().encode(`${echoPrefix}${data.trimEnd()}\r\n`);
    for (const listener of outputListeners) {
      listener(output);
    }
  },
  subscribeOutput(listener) {
    outputListeners.add(listener);
    harness.outputSubscribers = outputListeners.size;
    window.setTimeout(() => {
      if (outputListeners.has(listener)) {
        listener(new TextEncoder().encode(readyOutput));
      }
    }, 0);

    return {
      unsubscribe() {
        outputListeners.delete(listener);
        harness.outputSubscribers = outputListeners.size;
      }
    };
  },
  subscribeStatus(listener): TerminalSubscription {
    statusListeners.add(listener);
    listener({
      state: "attached",
      message: "Mounted keyboard smoke data plane attached"
    });

    return {
      unsubscribe() {
        statusListeners.delete(listener);
      }
    };
  },
  resize() {},
  detach() {
    outputListeners.clear();
    statusListeners.clear();
  }
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("mounted keyboard smoke root is missing");
}

createRoot(rootElement).render(
  <TerminalViewHost
    descriptor={descriptor}
    dataPlane={dataPlane}
    onAttachmentStatus={(sessionId, status) => {
      harness.statuses.push({ sessionId, state: status.state });
    }}
    onExit={(sessionId) => {
      harness.exitSessions.push(sessionId);
      harness.callbackOrder.push(`exit:${sessionId}`);
    }}
  />
);
