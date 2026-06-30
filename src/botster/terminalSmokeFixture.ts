import {
  DefaultTerminalViewBridge,
  MockTerminalDataPlane,
  type TerminalInput,
  type TerminalRendererAdapter,
  type TerminalSubscription,
  type TerminalViewDescriptor
} from "./terminal";

class FakeTerminalRenderer implements TerminalRendererAdapter {
  readonly writes: string[] = [];
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

  write(data: string): void {
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

class AttachedDataPlaneRenderer implements TerminalRendererAdapter {
  readonly lifecycle: string[];
  private dataPlane?: MockTerminalDataPlane;
  private outputSubscription?: TerminalSubscription;

  constructor(lifecycle: string[]) {
    this.lifecycle = lifecycle;
    this.lifecycle.push("attached:create");
  }

  mount(): void {
    this.lifecycle.push("attached:mount");
  }

  attachDataPlane(dataPlane: MockTerminalDataPlane): TerminalSubscription {
    this.lifecycle.push("attached:attachDataPlane");
    this.dataPlane = dataPlane;
    this.outputSubscription = dataPlane.subscribeOutput(() => undefined);

    return {
      unsubscribe: () => {
        this.lifecycle.push("attached:unsubscribe");
        this.outputSubscription?.unsubscribe();
        this.outputSubscription = undefined;
        this.dataPlane = undefined;
      }
    };
  }

  onInput(): TerminalSubscription {
    throw new Error("attached data-plane renderer owns input through pty transport");
  }

  emitRendererInput(data: TerminalInput): void {
    this.lifecycle.push(`attached:input:${data}`);
    void this.dataPlane?.writeInput(data);
  }

  write(): void {
    throw new Error("attached data-plane renderer owns output through pty transport");
  }

  resize(rows: number, columns: number): void {
    this.lifecycle.push(`attached:resize:${rows}x${columns}`);
    void this.dataPlane?.resize(rows, columns);
  }

  focus(): void {
    this.lifecycle.push("attached:focus");
  }

  destroy(): void {
    this.lifecycle.push("attached:destroy");
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
  const dataPlane = new MockTerminalDataPlane(descriptor.sessionId, ["ready\r\n"]);
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
  dataPlane.emitOutput("ok\r\n");
  await bridge.resize(descriptor, 24, 80);
  await bridge.focus(descriptor);
  await bridge.focus(descriptor);
  await bridge.unmount(descriptor);
  dataPlane.emitOutput("stale\r\n");
  renderers[0].emitInput("stale\n");

  await bridge.mount(container, descriptor);

  return {
    dataPlane,
    firstRenderer: renderers[0],
    secondRenderer: renderers[1],
    lifecycle
  };
}

export async function runRendererDataPlaneAttachFixture() {
  const descriptor: TerminalViewDescriptor = {
    sessionId: "terminal_view_attached_renderer_fixture",
    renderer: "restty"
  };
  const lifecycle: string[] = [];
  const renderers: AttachedDataPlaneRenderer[] = [];
  const bridge = new DefaultTerminalViewBridge(() => {
    const renderer = new AttachedDataPlaneRenderer(lifecycle);
    renderers.push(renderer);
    return renderer;
  });
  const dataPlane = new MockTerminalDataPlane(descriptor.sessionId, ["ready\r\n"]);
  const container = {} as HTMLElement;

  await bridge.mount(container, descriptor);
  await bridge.attach(descriptor, dataPlane);
  await bridge.attach(descriptor, dataPlane);
  renderers[0].emitRendererInput("renderer-path\n");
  await bridge.resize(descriptor, 12, 34);
  await bridge.unmount(descriptor);

  return {
    dataPlane,
    renderer: renderers[0],
    lifecycle
  };
}
