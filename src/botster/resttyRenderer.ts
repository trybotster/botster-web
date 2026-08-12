import { createInputHandler, Restty } from "../vendor/restty/internal.js";
import type { PtyCallbacks, PtyConnectOptions, PtyTransport } from "../vendor/restty/pty/types";
import type { ResttyFontSource } from "../vendor/restty/runtime/types";
import type {
  ModeDependentTerminalInput,
  TerminalDataPlaneAttachment,
  TerminalInput,
  TerminalRendererAdapter,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";
import type { DaemonModeFlags } from "./realHubDaemonDto";

const botsterResttyFontSources: ResttyFontSource[] = [
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf",
    label: "JetBrains Mono Nerd Font Regular"
  }
];

/**
 * Kitty flag used when Hub reports kitty_enabled without bit-level detail.
 * DisambiguateEscapeCodes (0x1) is the common baseline for protocol-enabled sessions.
 */
const kittyEnabledBaselineFlags = 0x1;

export class ResttyTerminalRenderer implements TerminalRendererAdapter {
  private readonly ptyTransport = new BotsterTerminalPtyTransport();
  private readonly inputListeners = new Set<(data: TerminalInput) => void>();
  private terminal?: Restty;
  private container?: HTMLElement;
  private lastKeyEvent: KeyboardEvent | undefined;
  private keyListener?: (event: KeyboardEvent) => void;
  constructor(readonly descriptor: TerminalViewDescriptor) {}

  mount(container: HTMLElement): void {
    this.container = container;
    this.ptyTransport.setRenderObserver((data) => {
      if (this.container?.dataset) {
        this.container.dataset.terminalLastRenderedOutput = data;
      }
      recordLiveHarnessTerminal("renderer_write", { data, sessionId: this.descriptor.sessionId });
    });
    this.ptyTransport.setSemanticKeyProvider(() => this.lastKeyEvent);

    this.keyListener = (event: KeyboardEvent) => {
      this.lastKeyEvent = event;
    };
    container.addEventListener("keydown", this.keyListener, true);

    this.terminal = new Restty({
      root: container,
      createInitialPane: { focus: false },
      fontSources: botsterResttyFontSources,
      appOptions: {
        // Pure renderer: session owns PTY queries including OSC color replies.
        readOnly: true,
        ptyTransport: this.ptyTransport,
        beforeInput: ({ text, source }) => {
          recordLiveHarnessTerminal("before_input", {
            text,
            source,
            sessionId: this.descriptor.sessionId
          });
          if (source !== "pty" && text) {
            this.emitInput(text);
          }
          return text;
        }
      }
    });
  }

  async loadBinarySnapshot(data: Uint8Array): Promise<boolean> {
    const terminal = this.terminal as Restty & {
      loadBinarySnapshot?: (bytes: Uint8Array) => boolean;
    } | undefined;
    if (!terminal?.loadBinarySnapshot) {
      recordLiveHarnessTerminal("ghostsnp_install_failed", {
        reason: "restty_loadBinarySnapshot_missing",
        sessionId: this.descriptor.sessionId
      });
      return false;
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    // Pane construction starts Restty init without awaiting. GHOSTSNP import requires
    // wasmReady + wasmHandle; poll until ready rather than re-entering init() (which is
    // not idempotent for GPU backends).
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const ok = terminal.loadBinarySnapshot(bytes);
        if (ok) {
          recordLiveHarnessTerminal("restty_load_binary_snapshot", {
            ok: true,
            bytes: bytes.byteLength,
            attempt,
            sessionId: this.descriptor.sessionId
          });
          return true;
        }
      } catch (error: unknown) {
        recordLiveHarnessTerminal("restty_load_binary_snapshot_error", {
          attempt,
          message: error instanceof Error ? error.message : String(error),
          sessionId: this.descriptor.sessionId
        });
      }
      await delay(50);
    }

    recordLiveHarnessTerminal("restty_load_binary_snapshot", {
      ok: false,
      bytes: bytes.byteLength,
      sessionId: this.descriptor.sessionId
    });
    return false;
  }

  attachDataPlane(dataPlane: TerminalDataPlaneAttachment): TerminalSubscription {
    dataPlane.bindBinarySnapshotInstaller?.((bytes) => this.loadBinarySnapshot(bytes));
    const subscription = this.ptyTransport.attach(dataPlane);
    this.terminal?.connectPty();
    return subscription;
  }

  onInput(listener: (data: TerminalInput) => void): TerminalSubscription {
    this.inputListeners.add(listener);

    return {
      unsubscribe: () => {
        this.inputListeners.delete(listener);
      }
    };
  }

  write(data: string): void {
    this.terminal?.sendInput(data, "pty");
  }

  resize(rows: number, columns: number): void {
    this.terminal?.resize(columns, rows);
  }

  focus(): void {
    this.terminal?.focus();
  }

  destroy(): void {
    if (this.container && this.keyListener) {
      this.container.removeEventListener("keydown", this.keyListener, true);
    }
    this.keyListener = undefined;
    this.lastKeyEvent = undefined;
    this.ptyTransport.destroy();
    this.inputListeners.clear();
    this.terminal?.destroy();
    this.terminal = undefined;
    this.container = undefined;
  }

  private emitInput(data: TerminalInput): void {
    for (const listener of this.inputListeners) {
      listener(data);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class BotsterTerminalPtyTransport implements PtyTransport {
  private dataPlane?: TerminalDataPlaneAttachment;
  private callbacks?: PtyCallbacks;
  private outputSubscription?: TerminalSubscription;
  private onRender?: (data: string) => void;
  private semanticKeyProvider?: () => KeyboardEvent | undefined;
  private connected = false;

  setRenderObserver(onRender: (data: string) => void): void {
    this.onRender = onRender;
  }

  setSemanticKeyProvider(provider: () => KeyboardEvent | undefined): void {
    this.semanticKeyProvider = provider;
  }

  attach(dataPlane: TerminalDataPlaneAttachment): TerminalSubscription {
    this.detach();
    this.dataPlane = dataPlane;
    this.outputSubscription = dataPlane.subscribeOutput((data) => {
      this.callbacks?.onData?.(data);
      this.onRender?.(data);
    });
    if (this.callbacks) {
      this.connected = true;
      this.callbacks.onConnect?.();
      recordLiveHarnessTerminal("pty_connected", { sessionId: this.dataPlane.sessionId });
    }

    return {
      unsubscribe: () => {
        this.detach();
      }
    };
  }

  connect(_options: PtyConnectOptions): void {
    this.callbacks = _options.callbacks;
    if (this.dataPlane) {
      this.connected = true;
      this.callbacks.onConnect?.();
      recordLiveHarnessTerminal("pty_connected", { sessionId: this.dataPlane.sessionId });
    }
  }

  disconnect(): void {
    if (this.connected) {
      this.connected = false;
      this.callbacks?.onDisconnect?.();
    }
  }

  sendInput(data: string): boolean {
    if (!this.dataPlane) return false;
    recordLiveHarnessTerminal("pty_send_input", { data, sessionId: this.dataPlane.sessionId });

    if (this.dataPlane.writeModeGatedInput) {
      const semantic = this.createModeDependentInput(data);
      void Promise.resolve(this.dataPlane.writeModeGatedInput(semantic)).catch((error: unknown) => {
        recordLiveHarnessTerminal("mode_gated_input_error", {
          message: error instanceof Error ? error.message : String(error),
          sessionId: this.dataPlane?.sessionId
        });
      });
      return true;
    }

    void this.dataPlane.writeInput(data);
    return true;
  }

  resize(cols: number, rows: number): boolean {
    if (!this.dataPlane?.resize) return false;
    void this.dataPlane.resize(rows, cols);
    return true;
  }

  isConnected(): boolean {
    return this.connected && Boolean(this.dataPlane);
  }

  destroy(): void {
    this.detach();
    this.callbacks = undefined;
    this.semanticKeyProvider = undefined;
  }

  private createModeDependentInput(initialBytes: string): ModeDependentTerminalInput {
    const keyEvent = this.semanticKeyProvider?.();
    let kittyFlags = 0;
    const inputHandler = createInputHandler({
      getKittyKeyboardFlags: () => kittyFlags
    });
    return {
      encode: (modes: DaemonModeFlags) => {
        if (keyEvent) {
          kittyFlags = kittyFlagsFromModeFlags(modes);
          return inputHandler.encodeKeyEvent(keyEvent);
        }
        // Mouse / paste / non-key paths: retain last encoded bytes for the first
        // attempt; re-encode is a no-op without a retained DOM event (unit tests
        // inject encode functions directly on the data plane).
        return initialBytes;
      }
    };
  }

  private detach(): void {
    this.outputSubscription?.unsubscribe();
    this.outputSubscription = undefined;
    if (this.connected) {
      this.connected = false;
      this.callbacks?.onDisconnect?.();
    }
    this.dataPlane = undefined;
  }
}

function kittyFlagsFromModeFlags(modes: DaemonModeFlags): number {
  return modes.kitty_enabled ? kittyEnabledBaselineFlags : 0;
}

function recordLiveHarnessTerminal(kind: string, payload: unknown): void {
  if (typeof window === "undefined") return;

  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      terminal?: Array<{ kind: string; payload: unknown }>;
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  harness?.terminal?.push({ kind, payload });
}

export function createResttyTerminalRenderer(
  descriptor: TerminalViewDescriptor
): TerminalRendererAdapter {
  return new ResttyTerminalRenderer(descriptor);
}
