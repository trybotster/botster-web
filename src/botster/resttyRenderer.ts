import { Restty } from "../vendor/restty/internal.js";
import type { PtyCallbacks, PtyConnectOptions, PtyTransport } from "../vendor/restty/pty/types";
import type { ResttyFontSource } from "../vendor/restty/runtime/types";
import type {
  TerminalDataPlaneAttachment,
  TerminalInput,
  TerminalRendererAdapter,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";

const botsterResttyFontSources: ResttyFontSource[] = [
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf",
    label: "JetBrains Mono Nerd Font Regular"
  }
];

export class ResttyTerminalRenderer implements TerminalRendererAdapter {
  private readonly ptyTransport = new BotsterTerminalPtyTransport();
  private readonly inputListeners = new Set<(data: TerminalInput) => void>();
  private terminal?: Restty;
  private container?: HTMLElement;

  constructor(readonly descriptor: TerminalViewDescriptor) {}

  mount(container: HTMLElement): void {
    this.container = container;
    this.ptyTransport.setRenderObserver((data) => {
      if (this.container?.dataset) {
        this.container.dataset.terminalLastRenderedOutput = data;
      }
      recordLiveHarnessTerminal("renderer_write", { data, sessionId: this.descriptor.sessionId });
    });
    this.terminal = new Restty({
      root: container,
      createInitialPane: { focus: false },
      fontSources: botsterResttyFontSources,
      appOptions: {
        ptyTransport: this.ptyTransport,
        beforeInput: ({ text, source }) => {
          if (source !== "pty" && text) {
            this.emitInput(text);
          }
          return text;
        }
      }
    });
  }

  attachDataPlane(dataPlane: TerminalDataPlaneAttachment): TerminalSubscription {
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

class BotsterTerminalPtyTransport implements PtyTransport {
  private dataPlane?: TerminalDataPlaneAttachment;
  private callbacks?: PtyCallbacks;
  private outputSubscription?: TerminalSubscription;
  private onRender?: (data: string) => void;
  private connected = false;

  setRenderObserver(onRender: (data: string) => void): void {
    this.onRender = onRender;
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
