export interface TerminalViewDescriptor {
  sessionId: string;
  renderer: "restty";
}

export interface TerminalViewBridge {
  mount(container: HTMLElement, descriptor: TerminalViewDescriptor): Promise<void>;
  unmount(descriptor: TerminalViewDescriptor): Promise<void>;
  resize(descriptor: TerminalViewDescriptor, rows: number, columns: number): Promise<void>;
}
