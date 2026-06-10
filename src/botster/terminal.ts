export interface TerminalViewDescriptor {
  sessionId: string;
  renderer: "restty";
}

export interface TerminalViewMount {
  sessionId: string;
  mountId: number;
}

export type TerminalInput = string;
export type TerminalOutput = string;

export interface TerminalSubscription {
  unsubscribe(): void;
}

export interface TerminalDataPlaneAttachment {
  sessionId: string;
  writeInput(data: TerminalInput): void | Promise<void>;
  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription;
  resize?(rows: number, columns: number): void | Promise<void>;
  detach?(): void | Promise<void>;
}

export interface TerminalRendererAdapter {
  mount(container: HTMLElement): void | Promise<void>;
  onInput(listener: (data: TerminalInput) => void): TerminalSubscription;
  write(data: TerminalOutput): void | Promise<void>;
  resize(rows: number, columns: number): void | Promise<void>;
  focus(): void | Promise<void>;
  destroy(): void | Promise<void>;
}

export type TerminalRendererFactory = (
  descriptor: TerminalViewDescriptor
) => TerminalRendererAdapter;

export interface TerminalViewBridge {
  attach(
    descriptor: TerminalViewDescriptor,
    dataPlane: TerminalDataPlaneAttachment
  ): Promise<void>;
  detach(descriptor: TerminalViewDescriptor): Promise<void>;
  mount(container: HTMLElement, descriptor: TerminalViewDescriptor): Promise<TerminalViewMount>;
  unmount(descriptor: TerminalViewDescriptor, mount?: TerminalViewMount): Promise<void>;
  resize(descriptor: TerminalViewDescriptor, rows: number, columns: number): Promise<void>;
  focus(descriptor: TerminalViewDescriptor): Promise<void>;
  writeInput(descriptor: TerminalViewDescriptor, data: TerminalInput): Promise<void>;
}

interface TerminalMountState {
  descriptor: TerminalViewDescriptor;
  mountId: number;
  renderer: TerminalRendererAdapter;
  dataPlane?: TerminalDataPlaneAttachment;
  inputSubscription?: TerminalSubscription;
  outputSubscription?: TerminalSubscription;
  focusing?: boolean;
}

export class DefaultTerminalViewBridge implements TerminalViewBridge {
  private readonly mounts = new Map<string, TerminalMountState>();
  private readonly mountOperations = new Map<string, Promise<unknown>>();
  private nextMountId = 1;

  constructor(private readonly createRenderer: TerminalRendererFactory) {}

  async mount(
    container: HTMLElement,
    descriptor: TerminalViewDescriptor
  ): Promise<TerminalViewMount> {
    const sessionId = descriptor.sessionId;
    const mountId = this.nextMountId;
    this.nextMountId += 1;
    const previousOperation = this.mountOperations.get(sessionId) ?? Promise.resolve();
    const operation = previousOperation.then(async () => {
      await this.unmount(descriptor);

      const renderer = this.createRenderer(descriptor);
      await renderer.mount(container);
      const mount: TerminalViewMount = { sessionId, mountId };
      this.mounts.set(sessionId, { descriptor, mountId, renderer });
      return mount;
    });

    const trackedOperation: Promise<unknown> = operation
      .catch(() => undefined)
      .finally(() => {
        if (this.mountOperations.get(sessionId) === trackedOperation) {
          this.mountOperations.delete(sessionId);
        }
      });
    this.mountOperations.set(sessionId, trackedOperation);

    return operation;
  }

  async attach(
    descriptor: TerminalViewDescriptor,
    dataPlane: TerminalDataPlaneAttachment
  ): Promise<void> {
    const state = this.requireMount(descriptor);

    await this.detach(descriptor);
    state.dataPlane = dataPlane;
    state.inputSubscription = state.renderer.onInput((data) => {
      void dataPlane.writeInput(data);
    });
    state.outputSubscription = dataPlane.subscribeOutput((data) => {
      void state.renderer.write(data);
    });
  }

  async detach(descriptor: TerminalViewDescriptor): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return;

    state.inputSubscription?.unsubscribe();
    state.outputSubscription?.unsubscribe();
    state.inputSubscription = undefined;
    state.outputSubscription = undefined;

    if (state.dataPlane?.detach) {
      await state.dataPlane.detach();
    }
    state.dataPlane = undefined;
  }

  async unmount(descriptor: TerminalViewDescriptor, mount?: TerminalViewMount): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return;
    if (mount && (mount.sessionId !== descriptor.sessionId || mount.mountId !== state.mountId)) {
      return;
    }

    await this.detach(descriptor);
    await state.renderer.destroy();
    this.mounts.delete(descriptor.sessionId);
  }

  async resize(
    descriptor: TerminalViewDescriptor,
    rows: number,
    columns: number
  ): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return;

    await state.renderer.resize(rows, columns);
    if (state.dataPlane?.resize) {
      await state.dataPlane.resize(rows, columns);
    }
  }

  async focus(descriptor: TerminalViewDescriptor): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state || state.focusing) return;

    state.focusing = true;
    try {
      await state.renderer.focus();
    } finally {
      state.focusing = false;
    }
  }

  async writeInput(descriptor: TerminalViewDescriptor, data: TerminalInput): Promise<void> {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) return;
    await state.dataPlane?.writeInput(data);
  }

  private requireMount(descriptor: TerminalViewDescriptor): TerminalMountState {
    const state = this.mounts.get(descriptor.sessionId);
    if (!state) {
      throw new Error(`terminal_view is not mounted for session ${descriptor.sessionId}`);
    }
    return state;
  }
}

export class MockTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly inputs: TerminalInput[] = [];
  readonly resizes: Array<{ rows: number; columns: number }> = [];
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private detached = false;

  constructor(
    readonly sessionId: string,
    private readonly initialOutput: TerminalOutput[] = []
  ) {}

  writeInput(data: TerminalInput): void {
    if (!this.detached) {
      this.inputs.push(data);
    }
  }

  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription {
    this.listeners.add(listener);
    this.initialOutput.forEach((line) => listener(line));

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      }
    };
  }

  emitOutput(data: TerminalOutput): void {
    if (!this.detached) {
      this.listeners.forEach((listener) => listener(data));
    }
  }

  resize(rows: number, columns: number): void {
    if (!this.detached) {
      this.resizes.push({ rows, columns });
    }
  }

  detach(): void {
    this.detached = true;
    this.listeners.clear();
  }
}
