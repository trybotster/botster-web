export type EntityFrameOperation =
  | "entity_snapshot"
  | "entity_upsert"
  | "entity_patch"
  | "entity_remove";

export interface EntityFrameKey {
  family: string;
  id: string;
}

export interface EntitySnapshotFrame {
  operation: "entity_snapshot";
  family: string;
  records: EntityRecord[];
  sequence?: number;
}

export interface EntityDeltaFrame {
  operation: Exclude<EntityFrameOperation, "entity_snapshot">;
  key: EntityFrameKey;
  record?: EntityRecord;
  sequence?: number;
}

export type EntityFrame = EntitySnapshotFrame | EntityDeltaFrame;

export type EntityRecord = Record<string, unknown> & { id: string };

export interface EntityPullRequest {
  family: string;
  id?: string;
  where?: Record<string, string | number | boolean>;
}

export interface EntityFrameStore {
  apply(frame: EntityFrame): void;
  pull(request: EntityPullRequest): Promise<void>;
  replayActivePulls(): Promise<void>;
  get(family: string, id: string): EntityRecord | undefined;
  list(family: string): EntityRecord[];
  activePullCount(): number;
}

export interface EntityFrameStoreOptions {
  sendPull?: (request: EntityPullRequest) => Promise<void>;
}

export class InMemoryEntityFrameStore implements EntityFrameStore {
  private readonly records = new Map<string, Map<string, EntityRecord>>();
  private readonly familySequences = new Map<string, number>();
  private readonly activePulls = new Map<string, EntityPullRequest>();
  private readonly sendPull: (request: EntityPullRequest) => Promise<void>;

  constructor(options: EntityFrameStoreOptions = {}) {
    this.sendPull = options.sendPull ?? (() => Promise.resolve());
  }

  apply(frame: EntityFrame): void {
    if (frame.operation === "entity_snapshot") {
      const nextRecords = new Map<string, EntityRecord>();

      for (const record of frame.records) {
        nextRecords.set(record.id, { ...record });
      }

      this.records.set(frame.family, nextRecords);

      if (typeof frame.sequence === "number") {
        this.familySequences.set(frame.family, frame.sequence);
      }

      return;
    }

    if (this.isStaleDelta(frame)) {
      return;
    }

    const family = this.family(frame.key.family);

    if (frame.operation === "entity_remove") {
      family.delete(frame.key.id);
      this.recordSequence(frame.key.family, frame.sequence);
      return;
    }

    if (!frame.record) {
      return;
    }

    const record = { ...frame.record, id: frame.key.id };

    if (frame.operation === "entity_patch") {
      const existing = family.get(frame.key.id);
      family.set(frame.key.id, mergeEntityRecord(existing, record));
    } else {
      family.set(frame.key.id, record);
    }

    this.recordSequence(frame.key.family, frame.sequence);
  }

  async pull(request: EntityPullRequest): Promise<void> {
    this.activePulls.set(entityPullKey(request), copyPullRequest(request));
    await this.sendPull(request);
  }

  async replayActivePulls(): Promise<void> {
    for (const request of this.activePulls.values()) {
      await this.sendPull(request);
    }
  }

  get(family: string, id: string): EntityRecord | undefined {
    const record = this.records.get(family)?.get(id);
    return record ? { ...record } : undefined;
  }

  list(family: string): EntityRecord[] {
    return Array.from(this.records.get(family)?.values() ?? [], (record) => ({ ...record }));
  }

  activePullCount(): number {
    return this.activePulls.size;
  }

  private family(name: string): Map<string, EntityRecord> {
    let family = this.records.get(name);

    if (!family) {
      family = new Map();
      this.records.set(name, family);
    }

    return family;
  }

  private isStaleDelta(frame: EntityDeltaFrame): boolean {
    if (typeof frame.sequence !== "number") {
      return false;
    }

    const currentSequence = this.familySequences.get(frame.key.family);
    return typeof currentSequence === "number" && frame.sequence < currentSequence;
  }

  private recordSequence(family: string, sequence: number | undefined): void {
    if (typeof sequence !== "number") {
      return;
    }

    const currentSequence = this.familySequences.get(family);
    if (typeof currentSequence !== "number" || sequence > currentSequence) {
      this.familySequences.set(family, sequence);
    }
  }
}

export function createEntityFrameStore(options: EntityFrameStoreOptions = {}): EntityFrameStore {
  return new InMemoryEntityFrameStore(options);
}

function mergeEntityRecord(existing: EntityRecord | undefined, patch: EntityRecord): EntityRecord {
  if (isPlainRecord(existing) && isPlainRecord(patch)) {
    return { ...existing, ...patch };
  }

  return patch;
}

function isPlainRecord(record: unknown): record is EntityRecord {
  return typeof record === "object" && record !== null && !Array.isArray(record);
}

function entityPullKey(request: EntityPullRequest): string {
  return JSON.stringify({
    family: request.family,
    id: request.id ?? null,
    where: request.where ? Object.entries(request.where).sort(([left], [right]) => left.localeCompare(right)) : []
  });
}

function copyPullRequest(request: EntityPullRequest): EntityPullRequest {
  return {
    family: request.family,
    id: request.id,
    where: request.where ? { ...request.where } : undefined
  };
}
