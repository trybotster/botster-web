export interface PluginSurfaceDescriptor {
  plugin: string;
  surface: string;
  sandbox: "host_rendered" | "isolated_asset";
}

export interface PluginSurfaceSandboxHost {
  mount(descriptor: PluginSurfaceDescriptor, container: HTMLElement): Promise<void>;
  unmount(descriptor: PluginSurfaceDescriptor): Promise<void>;
}
