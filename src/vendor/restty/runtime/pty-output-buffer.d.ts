export type CreatePtyOutputBufferControllerOptions = {
    idleMs: number;
    maxMs: number;
    onFlush: (text: string) => void;
    onFlushBytes?: (data: Uint8Array) => void;
};
export type PtyOutputBufferController = {
    queue: (text: string) => void;
    queueBytes: (data: Uint8Array) => void;
    flush: () => void;
    cancel: () => void;
    clear: () => void;
};
export declare function createPtyOutputBufferController(options: CreatePtyOutputBufferControllerOptions): PtyOutputBufferController;
