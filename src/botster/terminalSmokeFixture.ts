import {
  DefaultTerminalViewBridge,
  MockTerminalDataPlane,
  type TerminalInput,
  type TerminalOutput,
  type TerminalRendererAdapter,
  type TerminalSubscription,
  type TerminalViewDescriptor
} from "./terminal";

class FakeTerminalRenderer implements TerminalRendererAdapter {
  readonly writes: TerminalOutput[] = [];
  readonly resizes: Array<{ rows: number; columns: number }> = [];
  readonly lifecycle: string[];
  private inputListener?: (data: TerminalInput) => void;
  onFocus?: () => void;

  constructor(lifecycle: string[]) {
    this.lifecycle = lifecycle;
    this.lifecycle.push("create");
  }

  mount(): void {
    this.lifecycle.push("mount");
  }

  onInput(listener: (data: TerminalInput) => void): TerminalSubscription {
    this.inputListener = listener;

    return {
      unsubscribe: () => {
        this.inputListener = undefined;
        this.lifecycle.push("input:unsubscribe");
      }
    };
  }

  emitInput(data: TerminalInput): void {
    this.inputListener?.(data);
  }

  write(data: TerminalOutput): void {
    this.writes.push(data);
  }

  resize(rows: number, columns: number): void {
    this.resizes.push({ rows, columns });
  }

  focus(): void {
    this.lifecycle.push("focus");
    this.onFocus?.();
  }

  destroy(): void {
    this.lifecycle.push("destroy");
  }
}

export async function runTerminalViewBridgeSmokeFixture() {
  const descriptor: TerminalViewDescriptor = {
    sessionId: "terminal_view_smoke_fixture",
    renderer: "restty"
  };
  const lifecycle: string[] = [];
  const renderers: FakeTerminalRenderer[] = [];
  const bridge = new DefaultTerminalViewBridge(() => {
    const renderer = new FakeTerminalRenderer(lifecycle);
    renderers.push(renderer);
    return renderer;
  });
  const dataPlane = new MockTerminalDataPlane(descriptor.sessionId, [
    new TextEncoder().encode("ready\r\n")
  ]);
  const container = {} as HTMLElement;

  await bridge.focus(descriptor);
  await bridge.resize(descriptor, 1, 1);
  await bridge.writeInput(descriptor, "premount\n");

  await bridge.mount(container, descriptor);
  await bridge.attach(descriptor, dataPlane);
  await bridge.attach(descriptor, dataPlane);
  renderers[0].onFocus = () => {
    void bridge.focus(descriptor);
  };
  renderers[0].emitInput("ls\n");
  dataPlane.emitOutput(new TextEncoder().encode("ok\r\n"));
  await bridge.resize(descriptor, 24, 80);
  await bridge.focus(descriptor);
  await bridge.focus(descriptor);
  await bridge.unmount(descriptor);
  dataPlane.emitOutput(new TextEncoder().encode("stale\r\n"));
  renderers[0].emitInput("stale\n");

  await bridge.mount(container, descriptor);

  return {
    dataPlane,
    firstRenderer: renderers[0],
    secondRenderer: renderers[1],
    lifecycle
  };
}
