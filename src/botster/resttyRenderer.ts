import { Terminal as ResttyTerminal } from "../vendor/restty/xterm.js";
import type { ResttyFontSource } from "../vendor/restty/runtime/types";
import type {
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
  private readonly terminal = new ResttyTerminal({
    cols: 80,
    rows: 24,
    fontSources: botsterResttyFontSources
  });

  constructor(readonly descriptor: TerminalViewDescriptor) {}

  mount(container: HTMLElement): void {
    this.terminal.open(container);
  }

  onInput(listener: (data: TerminalInput) => void): TerminalSubscription {
    const disposable = this.terminal.onData(listener);

    return {
      unsubscribe: () => disposable.dispose()
    };
  }

  write(data: string): void {
    this.terminal.write(data);
  }

  resize(rows: number, columns: number): void {
    this.terminal.resize(columns, rows);
  }

  focus(): void {
    this.terminal.focus();
  }

  destroy(): void {
    this.terminal.dispose();
  }
}

export function createResttyTerminalRenderer(
  descriptor: TerminalViewDescriptor
): TerminalRendererAdapter {
  return new ResttyTerminalRenderer(descriptor);
}
