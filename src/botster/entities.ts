export type EntityFrameOperation =
  | "entity_snapshot"
  | "entity_upsert"
  | "entity_patch"
  | "entity_remove";

export interface EntityFrameKey {
  family: string;
  id: string;
}

export interface EntityFrame {
  operation: EntityFrameOperation;
  key: EntityFrameKey;
  record: unknown;
}

export interface EntityPullRequest {
  family: string;
  id?: string;
  where?: Record<string, string | number | boolean>;
}

export interface EntityFrameStore {
  apply(frame: EntityFrame): void;
  pull(request: EntityPullRequest): Promise<void>;
  replayActivePulls(): Promise<void>;
}
