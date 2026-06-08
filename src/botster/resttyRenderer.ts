import { Terminal as ResttyTerminal } from "../vendor/restty/xterm.js";
import type {
  TerminalInput,
  TerminalRendererAdapter,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";

export class ResttyTerminalRenderer implements TerminalRendererAdapter {
  private readonly terminal = new ResttyTerminal({
    cols: 80,
    rows: 24,
    appOptions: {
      fontPreset: "none"
    }
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
