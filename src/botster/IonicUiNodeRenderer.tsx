import {
  IonBadge,
  IonButton,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea
} from "@ionic/react";
import type { ReactNode } from "react";

import { defaultUiCapabilitySet } from "./capabilities";
import type { EntityFrameStore, EntityRecord } from "./entities";
import type {
  UiNode,
  UiNodeBinding,
  UiNodeRendererRegistry,
  UiNodeRenderOptions,
  UiTreeSnapshot
} from "./uiNodes";

type RowContext = Record<string, unknown>;

const supportedPrimitives = new Set([
  "action",
  "badge",
  "dialog",
  "empty_state",
  "field",
  "form",
  "heading",
  "inline",
  "list",
  "row",
  "section",
  "stack",
  "table",
  "text"
]);

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    : [];
}

function readSlot(node: UiNode, name = "children"): UiNode[] {
  return node.slots?.[name] ?? [];
}

function readRequiredCapabilities(node: UiNode): string[] {
  const requires = node.props?.requires;
  return Array.isArray(requires) ? requires.filter((capability): capability is string => typeof capability === "string") : [];
}

function missingCapabilities(node: UiNode, options: UiNodeRenderOptions): string[] {
  const capabilities = options.capabilities ?? defaultUiCapabilitySet;
  return readRequiredCapabilities(node).filter((capability) => capabilities[capability] !== true);
}

function parseEntityPath(path: string): { family: string; id?: string; field?: string } | undefined {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  const [family, id, ...fieldParts] = parts;
  return {
    family,
    id,
    field: fieldParts.length > 0 ? fieldParts.join(".") : undefined
  };
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").filter(Boolean).reduce<unknown>((value, part) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return (value as Record<string, unknown>)[part];
    }

    return undefined;
  }, record);
}

function entityRows(store: EntityFrameStore, binding: UiNodeBinding): EntityRecord[] {
  const parsed = parseEntityPath(binding.path);
  if (!parsed || parsed.id) {
    return [];
  }

  const rows = store.list(parsed.family);
  const where = binding.where ?? {};
  const whereEntries = Object.entries(where);

  if (whereEntries.length === 0) {
    return rows;
  }

  return rows.filter((record) => whereEntries.every(([key, value]) => record[key] === value));
}

function bindingValue(
  binding: UiNodeBinding,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext
): unknown {
  if (binding.source === "local_state") {
    return options.localState?.[binding.path];
  }

  if (binding.path.startsWith("@/")) {
    return row ? readPath(row, binding.path.slice(2)) : undefined;
  }

  const parsed = parseEntityPath(binding.path);
  if (!parsed) {
    return undefined;
  }

  if (!parsed.id) {
    return entityRows(store, binding);
  }

  const record = readRecord(store.get(parsed.family, parsed.id));
  return parsed.field ? readPath(record, parsed.field) : record;
}

function resolvedProps(
  node: UiNode,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext
): Record<string, unknown> {
  const props = { ...(node.props ?? {}) };

  for (const binding of node.bindings ?? []) {
    if (!binding.prop) {
      continue;
    }

    props[binding.prop] = bindingValue(binding, store, options, row);
  }

  return props;
}

function renderChildren(
  nodes: UiNode[],
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext
): ReactNode {
  return nodes.map((child) => renderNode(child, store, options, row));
}

function renderField(field: Record<string, unknown>): ReactNode {
  const id = readString(field.id);
  const label = readString(field.label, id);
  const kind = readString(field.kind, "text_input");
  const value = field.value;
  const errors = Array.isArray(field.errors) ? field.errors.filter((error): error is string => typeof error === "string") : [];

  const control =
    kind === "textarea" ? (
      <IonTextarea value={readString(value)} readonly />
    ) : kind === "checkbox" ? (
      <IonCheckbox checked={readBoolean(value)} disabled />
    ) : kind === "select" ? (
      <IonSelect value={value} disabled>
        {readRecords(field.options).map((option) => (
          <IonSelectOption key={readString(option.value)} value={option.value}>
            {readString(option.label)}
          </IonSelectOption>
        ))}
      </IonSelect>
    ) : (
      <IonInput value={readString(value)} readonly />
    );

  return (
    <IonItem key={id} className={errors.length > 0 ? "uinode-field invalid" : "uinode-field"}>
      <IonLabel position="stacked">{label}</IonLabel>
      {control}
      {errors.map((error) => (
        <IonNote color="danger" key={error} slot="error">
          {error}
        </IonNote>
      ))}
    </IonItem>
  );
}

function renderNode(
  node: UiNode,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext
): ReactNode {
  const missing = missingCapabilities(node, options);

  if (missing.length > 0) {
    return (
      <div className="uinode-fallback" data-ui-node-id={node.id} data-missing-capability={missing.join(",")} role="note" key={node.id}>
        Unsupported capability: {missing.join(", ")}
      </div>
    );
  }

  if (!supportedPrimitives.has(node.primitive)) {
    return (
      <div className="uinode-fallback" data-ui-node-id={node.id} data-unsupported-primitive={node.primitive} role="note" key={node.id}>
        Unsupported primitive: {node.primitive}
      </div>
    );
  }

  const props = resolvedProps(node, store, options, row);

  switch (node.primitive) {
    case "stack":
    case "section":
      return (
        <section className={`uinode-${node.primitive}`} data-ui-node-id={node.id} aria-label={readString(props.label, undefined)} key={node.id}>
          {renderChildren(readSlot(node), store, options, row)}
        </section>
      );
    case "inline":
    case "row":
      return (
        <div className={`uinode-${node.primitive}`} data-ui-node-id={node.id} key={node.id}>
          {renderChildren(readSlot(node), store, options, row)}
        </div>
      );
    case "heading": {
      const level = Math.min(Math.max(Number(props.level) || 2, 1), 4);
      const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4";
      return (
        <Heading data-ui-node-id={node.id} key={node.id}>
          {readString(props.text)}
        </Heading>
      );
    }
    case "text":
      return (
        <p data-ui-node-id={node.id} key={node.id}>
          {readString(props.text)}
        </p>
      );
    case "badge":
      return (
        <IonBadge color="medium" data-ui-node-id={node.id} key={node.id}>
          {readString(props.text)}
        </IonBadge>
      );
    case "empty_state":
      return (
        <div className="uinode-empty-state" data-ui-node-id={node.id} key={node.id}>
          <h3>{readString(props.title, "Nothing to show")}</h3>
          <p>{readString(props.body)}</p>
        </div>
      );
    case "action": {
      const action = readRecord(props.action);
      const id = readString(action.id);
      const label = readString(action.label, id);
      options.collectAction?.({ id, target: readString(action.target, undefined), params: readRecord(action.params), label, disabled: readBoolean(action.disabled) }, node);

      return (
        <IonButton
          data-ui-node-id={node.id}
          data-action-id={id}
          data-action-target={readString(action.target, undefined)}
          disabled={readBoolean(action.disabled)}
          key={node.id}
          onClick={() => {
            options.dispatchAction?.(
              { id, target: readString(action.target, undefined), params: readRecord(action.params), label, disabled: readBoolean(action.disabled) },
              node
            );
          }}
        >
          {label}
        </IonButton>
      );
    }
    case "list": {
      const rows = readRecords(props.items);
      const itemTemplate = readSlot(node, "item");

      if (rows.length === 0) {
        return (
          <div className="uinode-list" data-ui-node-id={node.id} key={node.id}>
            {renderChildren(readSlot(node, "empty"), store, options, row)}
          </div>
        );
      }

      return (
        <IonList className="uinode-list" data-ui-node-id={node.id} aria-label={readString(props.label, "Entity list")} key={node.id}>
          {rows.map((item, index) => (
            <IonItem key={readString(item.id, `${node.id}-${index}`)}>
              {renderChildren(itemTemplate, store, options, item)}
            </IonItem>
          ))}
        </IonList>
      );
    }
    case "table": {
      const columns = readRecords(props.columns);
      const rows = readRecords(props.rows);

      return (
        <div className="uinode-table" data-ui-node-id={node.id} key={node.id} role="table">
          <div className="uinode-table-row heading" role="row">
            {columns.map((column) => (
              <div role="columnheader" key={readString(column.key)}>
                {readString(column.label, readString(column.key))}
              </div>
            ))}
          </div>
          {rows.map((tableRow, index) => (
            <div className="uinode-table-row" role="row" key={readString(tableRow.id, `${node.id}-${index}`)}>
              {columns.map((column) => (
                <div role="cell" key={readString(column.key)}>
                  {String(tableRow[readString(column.key)] ?? "")}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    case "form": {
      const submit = readRecord(props.submit);
      const submitAction = {
        id: readString(submit.id),
        target: readString(submit.target, undefined),
        params: readRecord(submit.params),
        label: readString(submit.label, "Submit"),
        disabled: readBoolean(submit.disabled)
      };
      options.collectAction?.(submitAction, node);

      return (
        <form className="uinode-form" data-ui-node-id={node.id} key={node.id}>
          <h3>{readString(props.title, "Form")}</h3>
          <IonList>{readRecords(props.fields).map((field) => renderField(field))}</IonList>
          <IonButton
            data-action-id={submitAction.id}
            data-action-target={submitAction.target}
            disabled={submitAction.disabled}
            type="button"
            onClick={() => {
              options.dispatchAction?.(submitAction, node);
            }}
          >
            {submitAction.label}
          </IonButton>
        </form>
      );
    }
    case "field":
      return renderField({ id: node.id, ...props });
    case "dialog":
      return readBoolean(props.open) ? (
        <div className="uinode-dialog" data-ui-node-id={node.id} role="dialog" aria-modal="false" aria-label={readString(props.title)} key={node.id}>
          <h3>{readString(props.title)}</h3>
          {renderChildren(readSlot(node), store, options, row)}
        </div>
      ) : null;
    default:
      return null;
  }
}

export const ionicUiNodeRendererRegistry: UiNodeRendererRegistry = {
  render(snapshot: UiTreeSnapshot, entities: EntityFrameStore, options: UiNodeRenderOptions = {}) {
    return renderNode(snapshot.root, entities, options);
  },
  supports(primitive: string) {
    return supportedPrimitives.has(primitive);
  }
};
