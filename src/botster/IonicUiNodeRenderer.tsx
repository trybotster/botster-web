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
import { useMemo, useState, type ReactNode } from "react";

import { defaultUiCapabilitySet } from "./capabilities";
import type { ActionBinding } from "./actions";
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
  "button",
  "checkbox",
  "dialog",
  "empty_state",
  "form",
  "form_field",
  "form_section",
  "heading",
  "iframe",
  "inline",
  "list",
  "list_item",
  "row",
  "section",
  "select",
  "select_option",
  "stack",
  "table",
  "text",
  "text_input",
  "textarea"
]);

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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

function readChildren(node: UiNode): UiNode[] {
  return readSlot(node, "children");
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
  row?: RowContext,
  form?: FormRenderState
): ReactNode {
  return nodes.map((child) => renderNode(child, store, options, row, form));
}

const iframeSandboxTokens = new Set([
  "allow-downloads",
  "allow-forms",
  "allow-modals",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-presentation",
  "allow-same-origin",
  "allow-scripts"
]);

function iframeSandboxValue(props: Record<string, unknown>): string {
  return readStringArray(props.sandbox)
    .filter((token) => iframeSandboxTokens.has(token))
    .join(" ");
}

function iframeSrc(props: Record<string, unknown>): string | undefined {
  const src = readString(props.src).trim();
  if (!src) return undefined;
  if (src.startsWith("/") && !src.startsWith("//")) return src;

  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

type FormRenderState = {
  draft: Record<string, unknown>;
  setDraft: (update: (current: Record<string, unknown>) => Record<string, unknown>) => void;
};

function actionFromProps(props: Record<string, unknown>, fallbackLabel: string): ActionBinding {
  const action = props.action;
  if (typeof action === "string") {
    return {
      id: action,
      label: readString(props.label, fallbackLabel),
      params: {}
    };
  }

  const actionRecord = readRecord(action);
  return {
    id: readString(actionRecord.id),
    target: readString(actionRecord.target, undefined),
    params: readRecord(actionRecord.params),
    label: readString(actionRecord.label, readString(props.label, fallbackLabel)),
    disabled: readBoolean(actionRecord.disabled, readBoolean(props.disabled))
  };
}

function coreControlName(node: UiNode, props: Record<string, unknown>): string {
  return readString(props.name, node.id);
}

function coreControlInitialValue(node: UiNode, props: Record<string, unknown>): unknown {
  if (node.primitive === "checkbox") {
    return Object.hasOwn(props, "checked") ? props.checked : Object.hasOwn(props, "default") ? props.default : false;
  }

  if (node.primitive === "select") {
    return Object.hasOwn(props, "selected")
      ? props.selected
      : Object.hasOwn(props, "value")
        ? props.value
        : props.default;
  }

  return Object.hasOwn(props, "value") ? props.value : Object.hasOwn(props, "default") ? props.default : "";
}

function collectFormControlDefaults(nodes: UiNode[], store: EntityFrameStore, options: UiNodeRenderOptions, row?: RowContext): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [];
  const visit = (node: UiNode, currentRow?: RowContext) => {
    const props = resolvedProps(node, store, options, currentRow);
    if (["text_input", "textarea", "checkbox", "select"].includes(node.primitive)) {
      entries.push([coreControlName(node, props), coreControlInitialValue(node, props)]);
    } else if (node.primitive === "form_field") {
      const schema = readRecord(props.schema);
      entries.push([readString(schema.name, node.id), Object.hasOwn(props, "default") ? props.default : schema.default ?? ""]);
    }
    for (const children of Object.values(node.slots ?? {})) {
      children.forEach((child) => visit(child, currentRow));
    }
  };

  nodes.forEach((node) => visit(node, row));
  return Object.fromEntries(entries);
}

function renderCoreControl({
  node,
  props,
  form,
  optionNodes = []
}: {
  node: UiNode;
  props: Record<string, unknown>;
  form?: FormRenderState;
  optionNodes?: UiNode[];
}): ReactNode {
  const name = coreControlName(node, props);
  const label = readString(props.label, name);
  const description = readString(props.description, undefined);
  const error = readString(props.error, undefined);
  const required = readBoolean(props.required);
  const disabled = readBoolean(props.disabled) || !form;
  const value = form ? form.draft[name] : coreControlInitialValue(node, props);
  const labelText = required ? `${label} *` : label;
  const setValue = (nextValue: unknown) => {
    form?.setDraft((current) => ({ ...current, [name]: nextValue }));
  };

  const control =
    node.primitive === "textarea" ? (
      <IonTextarea
        value={readString(value)}
        placeholder={readString(props.placeholder, undefined)}
        onIonInput={(event) => setValue(event.detail.value ?? "")}
        readonly={disabled}
      />
    ) : node.primitive === "checkbox" ? (
      <IonCheckbox checked={readBoolean(value)} disabled={disabled} onIonChange={(event) => setValue(event.detail.checked)} />
    ) : node.primitive === "select" ? (
      <IonSelect value={value} disabled={disabled} onIonChange={(event) => setValue(event.detail.value)}>
        {optionNodes.map((optionNode) => {
          const optionProps = readRecord(optionNode.props);
          return (
            <IonSelectOption disabled={readBoolean(optionProps.disabled)} key={String(optionProps.value ?? optionNode.id)} value={optionProps.value}>
              {readString(optionProps.label, String(optionProps.value ?? ""))}
            </IonSelectOption>
          );
        })}
      </IonSelect>
    ) : (
      <IonInput
        value={readString(value)}
        placeholder={readString(props.placeholder, undefined)}
        onIonInput={(event) => setValue(event.detail.value ?? "")}
        readonly={disabled}
      />
    );

  return (
    <IonItem key={node.id} className={error ? "uinode-field invalid" : "uinode-field"} data-ui-node-id={node.id}>
      <IonLabel position="stacked">{labelText}</IonLabel>
      {control}
      {description ? <IonNote slot="helper">{description}</IonNote> : null}
      {error ? (
        <IonNote color="danger" slot="error">
          {error}
        </IonNote>
      ) : null}
    </IonItem>
  );
}

function UiNodeForm({
  node,
  props,
  store,
  options,
  row
}: {
  node: UiNode;
  props: Record<string, unknown>;
  store: EntityFrameStore;
  options: UiNodeRenderOptions;
  row?: RowContext;
}) {
  const children = readChildren(node);
  const initialDraft = useMemo(() => collectFormControlDefaults(children, store, options, row), [children, options, row, store]);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => initialDraft);
  const submitAction = actionFromProps(props, "Submit");
  options.collectAction?.(submitAction, node);

  return (
    <form className="uinode-form" data-ui-node-id={node.id}>
      {renderChildren(children, store, options, row, { draft, setDraft })}
      <IonButton
        data-action-id={submitAction.id}
        data-action-target={submitAction.target}
        disabled={submitAction.disabled}
        type="button"
        onClick={() => {
          options.dispatchAction?.(
            {
              ...submitAction,
              params: {
                ...submitAction.params,
                values: draft
              }
            },
            node
          );
        }}
      >
        {submitAction.label}
      </IonButton>
    </form>
  );
}

function renderNode(
  node: UiNode,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext,
  form?: FormRenderState
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
    case "form_section":
      return (
        <section className={`uinode-${node.primitive}`} data-ui-node-id={node.id} aria-label={readString(props.label, undefined)} key={node.id}>
          {readString(props.title) ? <h2>{readString(props.title)}</h2> : null}
          {readString(props.description) ? <p>{readString(props.description)}</p> : null}
          {renderChildren(readChildren(node), store, options, row, form)}
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
          <p>{readString(props.body, readString(props.description))}</p>
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
    case "button": {
      const action = actionFromProps(props, readString(props.label, node.id));
      options.collectAction?.(action, node);

      return (
        <IonButton
          data-ui-node-id={node.id}
          data-action-id={action.id}
          data-action-target={action.target}
          disabled={readBoolean(props.disabled) || action.disabled}
          key={node.id}
          onClick={() => options.dispatchAction?.(action, node)}
        >
          {readString(props.label, action.label)}
        </IonButton>
      );
    }
    case "list": {
      const rows = readRecords(props.items);
      const itemTemplate = readSlot(node, "item");
      const children = readChildren(node);

      if (rows.length === 0 && children.length > 0) {
        return (
          <IonList className="uinode-list" data-ui-node-id={node.id} aria-label={readString(props.label, readString(props.aria_label, "List"))} key={node.id}>
            {renderChildren(children, store, options, row)}
          </IonList>
        );
      }

      if (rows.length === 0) {
        return (
          <div className="uinode-list" data-ui-node-id={node.id} key={node.id}>
          {renderChildren(readSlot(node, "empty"), store, options, row, form)}
          </div>
        );
      }

      return (
        <IonList className="uinode-list" data-ui-node-id={node.id} aria-label={readString(props.label, "Entity list")} key={node.id}>
          {rows.map((item, index) => (
            <IonItem key={readString(item.id, `${node.id}-${index}`)}>
              {renderChildren(itemTemplate, store, options, item, form)}
            </IonItem>
          ))}
        </IonList>
      );
    }
    case "list_item":
      return (
        <IonItem data-ui-node-id={node.id} key={node.id}>
          <IonLabel>
            {renderChildren(readSlot(node, "title"), store, options, row, form)}
            {renderChildren(readSlot(node, "subtitle"), store, options, row, form)}
          </IonLabel>
          <div className="uinode-list-item-meta" slot="end">
            {renderChildren(readSlot(node, "meta"), store, options, row, form)}
          </div>
        </IonItem>
      );
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
      return <UiNodeForm node={node} props={props} store={store} options={options} row={row} key={node.id} />;
    }
    case "form_field": {
      const schema = readRecord(props.schema);
      const controlNode: UiNode = {
        id: node.id,
        primitive: readString(schema.kind, "text_input") === "text" ? "text_input" : readString(schema.kind, "text_input"),
        props: {
          ...schema,
          value: props.value,
          checked: props.checked,
          selected: props.selected,
          default: props.default,
          disabled: props.disabled,
          loading: props.loading,
          error: props.error
        }
      };
      return renderNode(controlNode, store, options, row, form);
    }
    case "text_input":
    case "textarea":
    case "checkbox":
    case "select":
      return renderCoreControl({
        node,
        props,
        form,
        optionNodes: readSlot(node, "options")
      });
    case "select_option":
      return null;
    case "iframe": {
      const src = iframeSrc(props);
      if (!src) {
        return (
          <div className="uinode-fallback" data-ui-node-id={node.id} data-unsupported-primitive="iframe-src" role="note" key={node.id}>
            Iframe source unavailable
          </div>
        );
      }

      return (
        <iframe
          className="uinode-iframe"
          data-ui-node-id={node.id}
          key={node.id}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox={iframeSandboxValue(props)}
          src={src}
          title={readString(props.title, node.id)}
        />
      );
    }
    case "dialog":
      return readBoolean(props.open) ? (
        <div className="uinode-dialog" data-ui-node-id={node.id} role="dialog" aria-modal="false" aria-label={readString(props.title)} key={node.id}>
          <h3>{readString(props.title)}</h3>
          {renderChildren(readSlot(node), store, options, row, form)}
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
