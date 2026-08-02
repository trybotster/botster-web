import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonCol,
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/react";
import { realizeBindListDescendantId } from "@trybotster/ui-contract";
import { Fragment, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { defaultUiCapabilitySet } from "./capabilities";
import type { EntityFrameStore, EntityRecord } from "./entities";
import type {
  JsonValue,
  JsonObject,
  UiAction,
  UiChild,
  UiNode,
  UiNodeActionDispatch,
  UiNodeRendererRegistry,
  UiNodeRenderOptions,
  UiPresentationPredicate,
  RealizedUiNode,
  UiTreeSnapshot
} from "./uiNodes";

const boundRowIdentity = Symbol("bound-row-identity");

type RowContext = Record<string, unknown> & { [boundRowIdentity]?: string };

type ResolvedChild = { node: RealizedUiNode; row?: RowContext; location: string };

type IdentityIssue = {
  kind: "duplicate-descendant-key" | "invalid-descendant-identity" | "duplicate-realized-identity";
  value: string;
  locations: string[];
};

const supportedPrimitives = new Set([
  "badge",
  "button",
  "checkbox",
  "dialog",
  "empty_state",
  "form",
  "form_field",
  "form_section",
  "iframe",
  "inline",
  "list",
  "list_item",
  "metric",
  "metric_grid",
  "panel",
  "section",
  "select",
  "select_option",
  "stack",
  "status_badge",
  "table",
  "text",
  "text_input",
  "textarea",
  "toolbar"
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

function readTableColumns(value: unknown): Array<{ key: string; label: string }> {
  return Array.isArray(value)
    ? value
        .map((column) => {
          if (typeof column === "string") {
            return { key: column, label: column };
          }

          const record = readRecord(column);
          const key = readString(record.key, readString(record.id));
          if (!key) {
            return undefined;
          }

          return { key, label: readString(record.label, key) };
        })
        .filter((column): column is { key: string; label: string } => Boolean(column))
    : [];
}

function uiNodeFromRecord(value: unknown): UiNode | undefined {
  const record = readRecord(value);
  const type = readString(record.type);
  if (!type) {
    return undefined;
  }

  return value as UiNode;
}

function hasSlot(node: UiNode, name: string): boolean {
  return readSlot(node, name).length > 0;
}

function readSlot(node: UiNode, name = "children"): UiChild[] {
  return node.slots?.[name] ?? [];
}

function readChildren(node: UiNode): UiChild[] {
  return [...(node.children ?? []), ...readSlot(node, "children")];
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

function entityRows(
  store: EntityFrameStore,
  source: string,
  where: Record<string, JsonValue> = {},
  row?: RowContext
): EntityRecord[] {
  const rowValues = source.startsWith("@/") && row ? readPath(row, source.slice(2)) : undefined;
  const parsed = source.startsWith("@/") ? undefined : parseEntityPath(source);
  if (!Array.isArray(rowValues) && (!parsed || parsed.id)) return [];

  const rows = Array.isArray(rowValues)
    ? rowValues
        .filter((value): value is EntityRecord => Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof (value as EntityRecord).id === "string"))
    : store.list(parsed!.family);
  const whereEntries = Object.entries(where);

  if (whereEntries.length === 0) {
    return rows;
  }

  return rows.filter((record) => whereEntries.every(([key, value]) => JSON.stringify(record[key]) === JSON.stringify(value)));
}

function pathValue(
  path: string,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext
): unknown {
  if (path.startsWith("local:")) {
    return options.localState?.[path.slice("local:".length)];
  }

  if (path.startsWith("@/")) {
    return row ? readPath(row, path.slice(2)) : undefined;
  }

  const parsed = parseEntityPath(path);
  if (!parsed) {
    return undefined;
  }

  if (!parsed.id) {
    return entityRows(store, path);
  }

  const record = readRecord(store.get(parsed.family, parsed.id));
  return parsed.field ? readPath(record, parsed.field) : record;
}

function resolvedValue(
  value: unknown,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolvedValue(item, store, options, row));
  }

  const record = readRecord(value);
  if (typeof record.$bind === "string") {
    return pathValue(record.$bind, store, options, row);
  }
  if (Object.keys(record).length > 0) {
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [key, resolvedValue(item, store, options, row)])
    );
  }
  return value;
}

function resolvedProps(
  node: UiNode,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext
): Record<string, unknown> {
  return resolvedValue(node.props ?? {}, store, options, row) as Record<string, unknown>;
}

function realizedNodeIdentity(
  node: UiNode,
  row?: RowContext,
  {
    allowRowBinding = false,
    issues,
    location = "root"
  }: { allowRowBinding?: boolean; issues?: IdentityIssue[]; location?: string } = {}
): RealizedUiNode | undefined {
  if (node.id === undefined || typeof node.id === "string") {
    return node as RealizedUiNode;
  }

  const authoredIdentity = readRecord(node.id);
  if (authoredIdentity.$kind === "bind_list_descendant_id") {
    const key = authoredIdentity.key;
    const rowIdentity = row?.[boundRowIdentity];
    if (typeof key !== "string" || key.trim().length === 0) {
      issues?.push({ kind: "invalid-descendant-identity", value: typeof key === "string" ? key : "<non-string>", locations: [location] });
      return undefined;
    }
    if (!rowIdentity) {
      issues?.push({ kind: "invalid-descendant-identity", value: key, locations: [location] });
      return undefined;
    }

    return { ...node, id: realizeBindListDescendantId(rowIdentity, key) } as RealizedUiNode;
  }

  const binding = authoredIdentity.$bind;
  if (!allowRowBinding) {
    issues?.push({
      kind: "invalid-descendant-identity",
      value: typeof binding === "string" ? binding : "<non-string>",
      locations: [location]
    });
    return undefined;
  }
  const resolved = typeof binding === "string" && binding.startsWith("@/") && row
    ? readPath(row, binding.slice(2))
    : undefined;
  if (typeof resolved !== "string" || resolved.trim().length === 0) {
    return undefined;
  }

  return { ...node, id: resolved } as RealizedUiNode;
}

function renderChildren(
  children: UiChild[],
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext,
  form?: FormRenderState
): ReactNode {
  return children.flatMap((child, index) =>
    resolveChild(child, store, options, row, undefined, `child[${index}]`).map(({ node, row: childRow }, childIndex) => (
      <Fragment key={`${node.id ?? node.type}-${index}-${childIndex}`}>
        {renderNode(node, store, options, childRow, form)}
      </Fragment>
    ))
  );
}

function isUiNode(child: UiChild): child is UiNode {
  return typeof (child as UiNode).type === "string";
}

function presentationMatches(predicate: UiPresentationPredicate, presentation: Record<string, JsonValue>): boolean {
  const hasKey = Object.hasOwn(presentation, predicate.key);
  if (predicate.kind === "present") return hasKey;
  if (predicate.kind === "truthy") return Boolean(presentation[predicate.key]);
  return hasKey && JSON.stringify(presentation[predicate.key]) === JSON.stringify(predicate.value);
}

function resolveChild(
  child: UiChild,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext,
  issues?: IdentityIssue[],
  location = "child"
): ResolvedChild[] {
  if (isUiNode(child)) {
    const node = realizedNodeIdentity(child, row, { issues, location });
    return node ? [{ node, row, location }] : [];
  }

  if (child.$kind === "bind_list") {
    const rows = entityRows(store, child.source, child.where, row);
    if (rows.length === 0) {
      const emptyLocation = `${location}.empty_template`;
      const node = child.empty_template
        ? realizedNodeIdentity(child.empty_template, row, { issues, location: emptyLocation })
        : undefined;
      return node ? [{ node, row, location: emptyLocation }] : [];
    }
    return rows.flatMap((record, index) => {
      const rowLocation = `${location}.item_template[row=${readString(record.id, `${index}`)}]`;
      const node = realizedNodeIdentity(child.item_template, record, {
        allowRowBinding: true,
        issues,
        location: rowLocation
      });
      if (!node) return [];

      const childRow = typeof child.item_template.id === "object" && "$bind" in readRecord(child.item_template.id) && node.id
        ? Object.assign({}, record, { [boundRowIdentity]: node.id })
        : record;
      return [{ node, row: childRow, location: rowLocation }];
    });
  }

  if (child.$kind === "bind_if") {
    const node = pathValue(child.path, store, options, row)
      ? realizedNodeIdentity(child.node, row, { issues, location: `${location}.node` })
      : undefined;
    return node ? [{ node, row, location: `${location}.node` }] : [];
  }

  if (child.$kind === "presentation_if") {
    const node = presentationMatches(child.predicate, options.presentation ?? {})
      ? realizedNodeIdentity(child.node, row, { issues, location: `${location}.node` })
      : undefined;
    return node ? [{ node, row, location: `${location}.node` }] : [];
  }

  const matches =
    (!child.condition.width || child.condition.width === "regular") &&
    (!child.condition.pointer || child.condition.pointer === "fine");
  const visible = child.$kind === "hidden" ? !matches : matches;
  const node = visible ? realizedNodeIdentity(child.node, row, { issues, location: `${location}.node` }) : undefined;
  return node ? [{ node, row, location: `${location}.node` }] : [];
}

function authoredIdentityIssues(root: UiNode): IdentityIssue[] {
  const issues: IdentityIssue[] = [];

  const validateTemplate = (template: UiNode, templateLocation: string) => {
    const keys = new Map<string, string[]>();

    const visitNode = (node: UiNode, location: string, templateRoot = false) => {
      const identity = readRecord(node.id);
      if (identity.$kind === "bind_list_descendant_id") {
        const key = identity.key;
        if (typeof key !== "string" || key.trim().length === 0) {
          issues.push({
            kind: "invalid-descendant-identity",
            value: typeof key === "string" ? key : "<non-string>",
            locations: [location]
          });
        } else {
          keys.set(key, [...(keys.get(key) ?? []), location]);
        }
        if (templateRoot) {
          issues.push({ kind: "invalid-descendant-identity", value: String(key), locations: [location] });
        }
      } else if (!templateRoot && typeof identity.$bind === "string") {
        issues.push({ kind: "invalid-descendant-identity", value: identity.$bind, locations: [location] });
      }

      const visitChild = (child: UiChild, childLocation: string) => {
        if (isUiNode(child)) {
          visitNode(child, childLocation);
        } else if (child.$kind === "bind_list") {
          if (child.empty_template) findTemplates(child.empty_template, `${childLocation}.empty_template`);
          validateTemplate(child.item_template, `${childLocation}.item_template`);
        } else {
          visitNode(child.node, `${childLocation}.node`);
        }
      };

      (node.children ?? []).forEach((child, index) => visitChild(child, `${location}.children[${index}]`));
      for (const [slot, children] of Object.entries(node.slots ?? {})) {
        children.forEach((child, index) => visitChild(child, `${location}.slots.${slot}[${index}]`));
      }
    };

    visitNode(template, templateLocation, true);
    for (const [key, locations] of keys) {
      if (locations.length > 1) {
        issues.push({ kind: "duplicate-descendant-key", value: key, locations: locations.slice(0, 2) });
      }
    }
  };

  const findTemplates = (node: UiNode, location: string) => {
    const identity = readRecord(node.id);
    if (identity.$kind === "bind_list_descendant_id") {
      issues.push({
        kind: "invalid-descendant-identity",
        value: typeof identity.key === "string" ? identity.key : "<non-string>",
        locations: [location]
      });
    }

    const visitChild = (child: UiChild, childLocation: string) => {
      if (isUiNode(child)) {
        findTemplates(child, childLocation);
      } else if (child.$kind === "bind_list") {
        validateTemplate(child.item_template, `${childLocation}.item_template`);
        if (child.empty_template) findTemplates(child.empty_template, `${childLocation}.empty_template`);
      } else {
        findTemplates(child.node, `${childLocation}.node`);
      }
    };

    (node.children ?? []).forEach((child, index) => visitChild(child, `${location}.children[${index}]`));
    for (const [slot, children] of Object.entries(node.slots ?? {})) {
      children.forEach((child, index) => visitChild(child, `${location}.slots.${slot}[${index}]`));
    }
  };

  findTemplates(root, "root");
  return issues;
}

function realizedIdentityIssue(
  root: RealizedUiNode,
  store: EntityFrameStore,
  options: UiNodeRenderOptions
): IdentityIssue | undefined {
  const issues: IdentityIssue[] = [];
  const identities = new Map<string, string[]>();

  const visitChildren = (children: UiChild[], row: RowContext | undefined, location: string) => {
    children.forEach((child, index) => {
      for (const resolved of resolveChild(child, store, options, row, issues, `${location}[${index}]`)) {
        visitNode(resolved.node, resolved.row, resolved.location);
      }
    });
  };

  const visitNode = (node: RealizedUiNode, row: RowContext | undefined, location: string) => {
    if (node.id) identities.set(node.id, [...(identities.get(node.id) ?? []), location]);
    if (missingCapabilities(node, options).length > 0 || !supportedPrimitives.has(node.type)) return;

    const props = resolvedProps(node, store, options, row);
    switch (node.type) {
      case "stack":
      case "form_section":
      case "inline":
      case "metric_grid":
      case "form":
        visitChildren(readChildren(node), row, `${location}.children`);
        break;
      case "section":
      case "panel": {
        visitChildren(readSlot(node, "header"), row, `${location}.slots.header`);
        visitChildren(readSlot(node, "toolbar"), row, `${location}.slots.toolbar`);
        visitChildren(readSlot(node, "body"), row, `${location}.slots.body`);
        visitChildren(readChildren(node), row, `${location}.children`);
        if (!hasSlot(node, "body") && readChildren(node).length === 0) {
          visitChildren(readSlot(node, "empty"), row, `${location}.slots.empty`);
        }
        visitChildren(readSlot(node, "footer"), row, `${location}.slots.footer`);
        visitChildren(readSlot(node, "actions"), row, `${location}.slots.actions`);
        break;
      }
      case "toolbar":
        for (const slot of ["commands", "filters", "search", "actions"]) {
          visitChildren(readSlot(node, slot), row, `${location}.slots.${slot}`);
        }
        visitChildren(readChildren(node), row, `${location}.children`);
        break;
      case "empty_state":
        visitChildren(readSlot(node, "actions"), row, `${location}.slots.actions`);
        break;
      case "list": {
        const rows = readRecords(props.items);
        if (rows.length > 0) {
          rows.forEach((item, index) => visitChildren(readSlot(node, "item"), item, `${location}.slots.item[row=${readString(item.id, `${index}`)}]`));
        } else if (readChildren(node).length > 0) {
          visitChildren(readChildren(node), row, `${location}.children`);
        } else {
          visitChildren(readSlot(node, "empty"), row, `${location}.slots.empty`);
        }
        break;
      }
      case "list_item":
        for (const slot of ["title", "subtitle", "meta", "actions"]) {
          visitChildren(readSlot(node, slot), row, `${location}.slots.${slot}`);
        }
        visitChildren(readChildren(node), row, `${location}.children`);
        break;
      case "select":
        visitChildren(readSlot(node, "options"), row, `${location}.slots.options`);
        break;
      case "dialog":
        visitChildren(readSlot(node, "body"), row, `${location}.slots.body`);
        visitChildren(readChildren(node), row, `${location}.children`);
        break;
      case "table": {
        if (readRecords(props.rows).length === 0) {
          const emptyState = uiNodeFromRecord(props.empty_state);
          const realizedEmptyState = emptyState
            ? realizedNodeIdentity(emptyState, row, { issues, location: `${location}.props.empty_state` })
            : undefined;
          if (realizedEmptyState) visitNode(realizedEmptyState, row, `${location}.props.empty_state`);
        }
        break;
      }
    }
  };

  visitNode(root, undefined, "root");
  if (issues.length > 0) return issues[0];

  for (const [identity, locations] of identities) {
    if (locations.length > 1) {
      return { kind: "duplicate-realized-identity", value: identity, locations: locations.slice(0, 2) };
    }
  }
  return undefined;
}

function identityDiagnostic(snapshot: UiTreeSnapshot, issue: IdentityIssue): ReactNode {
  const locations = issue.locations.map((location) => location.slice(0, 180)).join(" and ");
  const value = issue.value.trim().length > 0 ? issue.value : "<blank>";
  const label = issue.kind === "duplicate-descendant-key"
    ? "Duplicate BindList descendant key"
    : issue.kind === "duplicate-realized-identity"
      ? "Duplicate realized node identity"
      : "Invalid BindList descendant identity";

  return (
    <div
      className="uinode-fallback uinode-identity-diagnostic"
      data-ui-identity-diagnostic={issue.kind}
      data-ui-surface={snapshot.surface}
      role="alert"
    >
      {label} on {snapshot.surface}: {value} at {locations}
    </div>
  );
}

function renderSlotRegion(
  node: UiNode,
  name: string,
  store: EntityFrameStore,
  options: UiNodeRenderOptions,
  row?: RowContext,
  form?: FormRenderState,
  role?: "status"
): ReactNode {
  if (!hasSlot(node, name)) return null;

  return (
    <div className={`uinode-slot uinode-slot-${name}`} data-ui-slot={name} role={role}>
      {renderChildren(readSlot(node, name), store, options, row, form)}
    </div>
  );
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
  actionResult?: UiNodeRenderOptions["actionResult"];
};

type SelectOption = {
  key: string;
  value: unknown;
  label: string;
  disabled: boolean;
};

function uiNodeGap(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.max(value, 0)}px`;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  if (/^\d+(\.\d+)?(px|rem|em)$/.test(value)) {
    return value;
  }

  return {
    none: "0",
    tight: "6px",
    small: "8px",
    normal: "12px",
    medium: "12px",
    large: "16px",
    loose: "20px"
  }[value];
}

function uiNodeAlignment(value: unknown): string | undefined {
  return typeof value === "string" && ["start", "center", "end", "stretch", "baseline"].includes(value) ? value : undefined;
}

function uiNodeJustify(value: unknown): string | undefined {
  return typeof value === "string" && ["start", "center", "end", "between", "around", "evenly"].includes(value) ? value : undefined;
}

function layoutStyle(props: Record<string, unknown>): CSSProperties | undefined {
  const gap = uiNodeGap(props.gap);
  const align = uiNodeAlignment(props.align);
  const justify = uiNodeJustify(props.justify);

  if (!gap && !align && !justify) {
    return undefined;
  }

  const style: CSSProperties & { "--uinode-gap"?: string } = {};
  if (gap) style["--uinode-gap"] = gap;
  if (align) style.alignItems = align === "start" || align === "end" ? `flex-${align}` : align;
  if (justify) {
    style.justifyContent =
      justify === "between"
        ? "space-between"
        : justify === "around"
          ? "space-around"
          : justify === "evenly"
            ? "space-evenly"
            : justify === "start" || justify === "end"
              ? `flex-${justify}`
              : justify;
  }

  return style;
}

function ionicTone(props: Record<string, unknown>, fallback = "medium"): string {
  const tone = readString(props.tone, readString(props.color, fallback));
  if (["primary", "secondary", "tertiary", "success", "warning", "danger", "light", "medium", "dark"].includes(tone)) {
    return tone;
  }

  return {
    info: "primary",
    neutral: "medium",
    muted: "medium",
    error: "danger"
  }[tone] ?? fallback;
}

function actionFromProps(props: Record<string, unknown>): UiAction {
  return actionFromValue(props.action);
}

function actionFromValue(action: unknown): UiAction {
  const actionRecord = readRecord(action);
  return {
    id: readString(actionRecord.id),
    payload: Object.hasOwn(actionRecord, "payload") ? actionRecord.payload as JsonValue : undefined,
    disabled: readBoolean(actionRecord.disabled)
  };
}

function actionButton(
  action: UiAction,
  node: RealizedUiNode,
  options: UiNodeRenderOptions,
  label: string,
  className?: string,
  stopPropagation = false
): ReactNode {
  const dispatch: UiNodeActionDispatch = { action, node, kind: "submit" };
  options.collectAction?.(dispatch);

  return (
    <IonButton
      className={className}
      data-action-id={action.id}
      disabled={action.disabled}
      key={`${node.id}-${action.id}`}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        if (!action.disabled) options.dispatchAction?.(dispatch);
      }}
    >
      {label}
    </IonButton>
  );
}

function selectedValueSet(selection: unknown): Set<string> {
  const selected = readRecord(selection).selected;
  return new Set(
    (Array.isArray(selected) ? selected : [])
      .filter((value) => typeof value === "string" || typeof value === "number")
      .map((value) => String(value))
  );
}

function selectionIsActive(selection: unknown): boolean {
  const selectionRecord = readRecord(selection);
  const mode = readString(selectionRecord.mode);
  return mode === "single" || mode === "multiple";
}

function isValueSelected(value: unknown, selectedValues: Set<string>): boolean {
  return (typeof value === "string" || typeof value === "number") && selectedValues.has(String(value));
}

function dispatchActivationOnEnter(event: KeyboardEvent, action: UiAction | undefined, node: RealizedUiNode, options: UiNodeRenderOptions): void {
  if (!action || action.disabled || event.key !== "Enter") return;
  event.preventDefault();
  options.dispatchAction?.({ action, node, kind: "submit" });
}

function coreControlName(node: RealizedUiNode, props: Record<string, unknown>): string {
  return readString(props.name, node.id ?? "");
}

function coreControlInitialValue(node: RealizedUiNode, props: Record<string, unknown>): unknown {
  if (node.type === "checkbox") {
    return Object.hasOwn(props, "checked") ? props.checked : Object.hasOwn(props, "default") ? props.default : false;
  }

  if (node.type === "select") {
    return Object.hasOwn(props, "selected")
      ? props.selected
      : Object.hasOwn(props, "value")
        ? props.value
        : props.default;
  }

  return Object.hasOwn(props, "value") ? props.value : Object.hasOwn(props, "default") ? props.default : "";
}

function readSelectOptions(props: Record<string, unknown>, optionNodes: RealizedUiNode[]): SelectOption[] {
  const schemaOptions = readRecords(props.options).map((option, index) => {
    const value = Object.hasOwn(option, "value") ? option.value : readString(option.id, `${index}`);
    return {
      key: readString(option.id, String(value)),
      value,
      label: readString(option.label, String(value ?? "")),
      disabled: readBoolean(option.disabled)
    };
  });

  if (schemaOptions.length > 0) {
    return schemaOptions;
  }

  return optionNodes.map((optionNode) => {
    const optionProps = readRecord(optionNode.props);
    const value = Object.hasOwn(optionProps, "value") ? optionProps.value : optionNode.id;
    return {
      key: String(value ?? optionNode.id),
      value,
      label: readString(optionProps.label, String(value ?? "")),
      disabled: readBoolean(optionProps.disabled)
    };
  });
}

function collectFormControlDefaults(children: UiChild[], store: EntityFrameStore, options: UiNodeRenderOptions, row?: RowContext): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [];
  const visit = (node: RealizedUiNode, currentRow?: RowContext) => {
    const props = resolvedProps(node, store, options, currentRow);
    if (["text_input", "textarea", "checkbox", "select"].includes(node.type)) {
      entries.push([coreControlName(node, props), coreControlInitialValue(node, props)]);
    } else if (node.type === "form_field") {
      const schema = readRecord(props.schema);
      entries.push([readString(schema.name, node.id), Object.hasOwn(props, "default") ? props.default : schema.default ?? ""]);
    }
    for (const child of [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()]) {
      for (const resolved of resolveChild(child, store, options, currentRow)) {
        visit(resolved.node, resolved.row);
      }
    }
  };

  for (const child of children) {
    for (const resolved of resolveChild(child, store, options, row)) {
      visit(resolved.node, resolved.row);
    }
  }
  return Object.fromEntries(entries);
}

function renderCoreControl({
  node,
  props,
  form,
  optionNodes = []
}: {
  node: RealizedUiNode;
  props: Record<string, unknown>;
  form?: FormRenderState;
  optionNodes?: RealizedUiNode[];
}): ReactNode {
  const name = coreControlName(node, props);
  const label = readString(props.label, name);
  const description = readString(props.description, undefined);
  const fieldErrors = node.id ? form?.actionResult?.field_errors?.[node.id] ?? [] : [];
  const error = fieldErrors[0] ?? readString(props.error, undefined);
  const required = readBoolean(props.required);
  const disabled = readBoolean(props.disabled) || !form;
  const value = form ? form.draft[name] : coreControlInitialValue(node, props);
  const labelText = required ? `${label} *` : label;
  const setValue = (nextValue: unknown) => {
    form?.setDraft((current) => ({ ...current, [name]: nextValue }));
  };
  const selectOptions = node.type === "select" ? readSelectOptions(props, optionNodes) : [];

  const control =
    node.type === "textarea" ? (
      <IonTextarea
        value={readString(value)}
        placeholder={readString(props.placeholder, undefined)}
        onIonInput={(event) => setValue(event.detail.value ?? "")}
        readonly={disabled}
      />
    ) : node.type === "checkbox" ? (
      <IonCheckbox checked={readBoolean(value)} disabled={disabled} onIonChange={(event) => setValue(event.detail.checked)} />
    ) : node.type === "select" ? (
      <IonSelect value={value} disabled={disabled} onIonChange={(event) => setValue(event.detail.value)}>
        {selectOptions.map((option) => (
          <IonSelectOption disabled={option.disabled} key={option.key} value={option.value}>
            {option.label}
          </IonSelectOption>
        ))}
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
        <IonNote className="uinode-field-error" color="danger">
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
  node: RealizedUiNode;
  props: Record<string, unknown>;
  store: EntityFrameStore;
  options: UiNodeRenderOptions;
  row?: RowContext;
}) {
  const children = readChildren(node);
  const submitAction = actionFromProps(props);
  const latestActionResult = options.actionResult;
  const actionResult = latestActionResult && latestActionResult.node_id === node.id && latestActionResult.action_id === submitAction.id
    ? latestActionResult
    : undefined;
  const initialDraft = useMemo(
    () => collectFormControlDefaults(children, store, options, row),
    [children, options, row, store]
  );
  const [draft, setDraft] = useState<Record<string, unknown>>(() => initialDraft);
  const [appliedResultId, setAppliedResultId] = useState<string>();
  if (actionResult && actionResult.request_id !== appliedResultId) {
    setAppliedResultId(actionResult.request_id);
    if (actionResult.normalized_values) {
      setDraft((current) => ({ ...current, ...actionResult.normalized_values }));
    }
  }
  const submitDispatch: UiNodeActionDispatch = {
    action: submitAction,
    node,
    kind: "submit",
    values: draft as UiNodeActionDispatch["values"]
  };
  options.collectAction?.(submitDispatch);

  return (
    <form className="uinode-form" data-ui-node-id={node.id}>
      {renderChildren(children, store, options, row, { draft, setDraft, actionResult })}
      {actionResult?.form_errors?.map((error) => (
        <IonNote color="danger" className="uinode-form-error" key={error}>{error}</IonNote>
      ))}
      <IonButton
        data-action-id={submitAction.id}
        disabled={submitAction.disabled}
        type="button"
        onClick={() => options.dispatchAction?.({ ...submitDispatch, values: draft as UiNodeActionDispatch["values"] })}
      >
        {readString(props.submit_label, "Submit")}
      </IonButton>
    </form>
  );
}

function renderNode(
  node: RealizedUiNode,
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

  if (!supportedPrimitives.has(node.type)) {
    return (
      <div className="uinode-fallback" data-ui-node-id={node.id} data-unsupported-primitive={node.type} role="note" key={node.id}>
        Unsupported primitive: {node.type}
      </div>
    );
  }

  const props = resolvedProps(node, store, options, row);

  switch (node.type) {
    case "stack":
    case "form_section":
      return (
        <section
          className={`uinode-${node.type}`}
          data-ui-node-id={node.id}
          aria-label={readString(props.label, undefined)}
          key={node.id}
          style={layoutStyle(props)}
        >
          {readString(props.title) ? <h2>{readString(props.title)}</h2> : null}
          {readString(props.description) ? <p>{readString(props.description)}</p> : null}
          {renderChildren(readChildren(node), store, options, row, form)}
        </section>
      );
    case "section": {
      const hasBody = hasSlot(node, "body") || readChildren(node).length > 0;
      return (
        <section
          className={`uinode-section density-${readString(props.density, "regular")} variant-${readString(props.variant, "plain")}`}
          data-ui-node-id={node.id}
          aria-label={readString(props.label, undefined)}
          key={node.id}
          style={layoutStyle(props)}
        >
          {readString(props.title) ? <h2>{readString(props.title)}</h2> : null}
          {readString(props.description) ? <p>{readString(props.description)}</p> : null}
          {renderSlotRegion(node, "header", store, options, row, form)}
          {renderSlotRegion(node, "toolbar", store, options, row, form)}
          {renderSlotRegion(node, "body", store, options, row, form)}
          {renderChildren(readChildren(node), store, options, row, form)}
          {!hasBody ? renderSlotRegion(node, "empty", store, options, row, form, "status") : null}
          {renderSlotRegion(node, "footer", store, options, row, form)}
          {renderSlotRegion(node, "actions", store, options, row, form)}
        </section>
      );
    }
    case "panel": {
      const hasBody = hasSlot(node, "body") || readChildren(node).length > 0;
      return (
        <IonCard
          className={`uinode-panel density-${readString(props.density, "regular")} variant-${readString(props.variant, "plain")}`}
          data-ui-node-id={node.id}
          key={node.id}
        >
          {readString(props.title) || readString(props.description) ? (
            <IonCardHeader>
              {readString(props.title) ? <IonCardTitle>{readString(props.title)}</IonCardTitle> : null}
              {readString(props.description) ? <IonCardSubtitle>{readString(props.description)}</IonCardSubtitle> : null}
              {renderSlotRegion(node, "header", store, options, row, form)}
            </IonCardHeader>
          ) : renderSlotRegion(node, "header", store, options, row, form)}
          {renderSlotRegion(node, "toolbar", store, options, row, form)}
          <IonCardContent>
            {renderSlotRegion(node, "body", store, options, row, form)}
            {renderChildren(readChildren(node), store, options, row, form)}
            {!hasBody ? renderSlotRegion(node, "empty", store, options, row, form, "status") : null}
            {renderSlotRegion(node, "footer", store, options, row, form)}
            {renderSlotRegion(node, "actions", store, options, row, form)}
          </IonCardContent>
        </IonCard>
      );
    }
    case "inline":
      return (
        <div className={`uinode-${node.type}`} data-ui-node-id={node.id} key={node.id} style={layoutStyle(props)}>
          {renderChildren(readChildren(node), store, options, row, form)}
        </div>
      );
    case "text":
      return (
        <p data-ui-node-id={node.id} key={node.id}>
          {readString(props.text)}
        </p>
      );
    case "badge":
      return (
        <IonBadge color={ionicTone(props)} data-ui-node-id={node.id} key={node.id}>
          {readString(props.text)}
        </IonBadge>
      );
    case "status_badge":
      return (
        <IonBadge
          className="uinode-status-badge"
          color={ionicTone(props)}
          data-ui-node-id={node.id}
          data-status={readString(props.status, undefined)}
          key={node.id}
        >
          {readString(props.label, readString(props.status))}
        </IonBadge>
      );
    case "toolbar":
      return (
        <IonToolbar
          className={`uinode-toolbar density-${readString(props.density, "regular")} variant-${readString(props.variant, "plain")}`}
          data-ui-node-id={node.id}
          key={node.id}
        >
          {readString(props.label) ? <IonTitle>{readString(props.label)}</IonTitle> : null}
          {hasSlot(node, "commands") ? <IonButtons slot="start">{renderChildren(readSlot(node, "commands"), store, options, row, form)}</IonButtons> : null}
          {hasSlot(node, "filters") ? <div className="uinode-toolbar-filters" data-ui-slot="filters" slot="secondary">{renderChildren(readSlot(node, "filters"), store, options, row, form)}</div> : null}
          {hasSlot(node, "search") ? <div className="uinode-toolbar-search" data-ui-slot="search" slot="primary">{renderChildren(readSlot(node, "search"), store, options, row, form)}</div> : null}
          {hasSlot(node, "actions") ? <IonButtons slot="end">{renderChildren(readSlot(node, "actions"), store, options, row, form)}</IonButtons> : null}
          {renderChildren(readChildren(node), store, options, row, form)}
        </IonToolbar>
      );
    case "metric_grid": {
      const children = readChildren(node).flatMap((child) => resolveChild(child, store, options, row));
      const compact = readBoolean(props.compact) || readString(props.density) === "compact";

      return (
        <IonGrid
          className={`uinode-metric-grid density-${readString(props.density, "regular")} variant-${readString(props.variant, "plain")}`}
          data-ui-node-id={node.id}
          fixed={false}
          key={node.id}
        >
          <IonRow>
            {children.map(({ node: child, row: childRow }, index) => (
              <IonCol key={child.id ?? `${child.type}-${index}`} size="12" sizeMd={compact ? "4" : "6"} sizeLg={compact ? "3" : "4"}>
                {renderNode(child, store, options, childRow, form)}
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
      );
    }
    case "metric":
      return (
        <IonCard
          className={`uinode-metric tone-${ionicTone(props, "medium")}`}
          data-ui-node-id={node.id}
          data-status={readString(props.status, undefined)}
          key={node.id}
        >
          <IonCardContent>
            <p className="uinode-metric-label">{readString(props.label)}</p>
            <strong className="uinode-metric-value">{readString(props.value)}</strong>
            {readString(props.caption) ? <p className="uinode-metric-caption">{readString(props.caption)}</p> : null}
          </IonCardContent>
        </IonCard>
      );
    case "empty_state":
      {
        const emptyStateActions = [
          ["action", "Action"],
          ["primary_action", "Primary action"],
          ["secondary_action", "Secondary action"]
        ].map(([propName, fallbackLabel]) => {
          const action = actionFromValue(props[propName]);
          return action.id ? actionButton(action, node, options, fallbackLabel) : null;
        }).filter(Boolean);

        return (
          <div className="uinode-empty-state" data-ui-node-id={node.id} key={node.id} role="status">
            <div className="uinode-empty-state-copy">
              <h3>{readString(props.title, "Nothing to show")}</h3>
              <p>{readString(props.body, readString(props.description))}</p>
            </div>
            {emptyStateActions.length > 0 || hasSlot(node, "actions") ? (
              <IonButtons className="uinode-empty-state-actions">
                {emptyStateActions}
                {hasSlot(node, "actions") ? renderChildren(readSlot(node, "actions"), store, options, row, form) : null}
              </IonButtons>
            ) : null}
          </div>
        );
      }
    case "button": {
      const action = actionFromProps(props);
      const dispatch: UiNodeActionDispatch = {
        action,
        node,
        kind: "submit",
        ...(form ? { values: form.draft as UiNodeActionDispatch["values"] } : {})
      };
      options.collectAction?.(dispatch);

      return (
        <IonButton
          data-ui-node-id={node.id}
          data-action-id={action.id}
          data-overflow={readString(props.overflow, undefined)}
          disabled={readBoolean(props.disabled) || action.disabled}
          key={node.id}
          onClick={() => options.dispatchAction?.(dispatch)}
        >
          {readString(props.label, action.id)}
        </IonButton>
      );
    }
    case "list": {
      const rows = readRecords(props.items);
      const itemTemplate = readSlot(node, "item");
      const children = readChildren(node);
      const selectable = selectionIsActive(props.selection);
      const selectedValues = selectedValueSet(props.selection);
      const listChildren = children.map((child) => {
        if (!isUiNode(child) || child.type !== "list_item") return child;
        const childProps = readRecord(child.props);
        if (!selectable) return child;
        return {
          ...child,
          props: {
            ...childProps,
            selected: isValueSelected(childProps.value, selectedValues),
            selectable: true
          }
        };
      });

      if (rows.length === 0 && listChildren.length > 0) {
        return (
          <IonList
            className="uinode-list"
            data-ui-node-id={node.id}
            aria-label={readString(props.label, readString(props.aria_label, "List"))}
            key={node.id}
            role={selectable ? "listbox" : undefined}
          >
            {renderChildren(listChildren, store, options, row)}
          </IonList>
        );
      }

      if (rows.length === 0) {
        return (
          <div className="uinode-list" data-ui-node-id={node.id} key={node.id}>
            {hasSlot(node, "empty") ? renderChildren(readSlot(node, "empty"), store, options, row, form) : <div className="uinode-empty-state" role="status"><div className="uinode-empty-state-copy"><h3>No items</h3></div></div>}
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
    case "list_item": {
      const hasEndContent = hasSlot(node, "meta") || hasSlot(node, "actions");
      const activation = actionFromValue(props.activation);
      const explicitAction = actionFromValue(props.action);
      const selected = readBoolean(props.selected);
      const selectable = readBoolean(props.selectable);
      if (activation.id) options.collectAction?.({ action: activation, node, kind: "submit" });
      return (
        <IonItem
          aria-selected={selectable ? selected : undefined}
          button={Boolean(activation.id && !activation.disabled)}
          className={selected ? "uinode-list-item selected" : "uinode-list-item"}
          data-activation-action-id={activation.id || undefined}
          data-selected={selected ? "true" : undefined}
          data-ui-node-id={node.id}
          key={node.id}
          onClick={() => {
            if (activation.id && !activation.disabled) options.dispatchAction?.({ action: activation, node, kind: "submit" });
          }}
          onKeyDown={(event) => dispatchActivationOnEnter(event, activation.id ? activation : undefined, node, options)}
          role={selectable ? "option" : undefined}
        >
          <IonLabel className="uinode-list-item-label">
            <div className="uinode-list-item-title">{renderChildren(readSlot(node, "title"), store, options, row, form)}</div>
            {hasSlot(node, "subtitle") ? <div className="uinode-list-item-subtitle">{renderChildren(readSlot(node, "subtitle"), store, options, row, form)}</div> : null}
            {renderChildren(readChildren(node), store, options, row, form)}
          </IonLabel>
          {hasEndContent || explicitAction.id ? (
            <div className="uinode-list-item-end" slot="end">
              {hasSlot(node, "meta") ? <div className="uinode-list-item-meta">{renderChildren(readSlot(node, "meta"), store, options, row, form)}</div> : null}
              {hasSlot(node, "actions") ? <IonButtons className="uinode-list-item-actions">{renderChildren(readSlot(node, "actions"), store, options, row, form)}</IonButtons> : null}
              {explicitAction.id ? (
                <IonButtons className="uinode-list-item-actions">
                  {actionButton(explicitAction, node, options, "Open", undefined, true)}
                </IonButtons>
              ) : null}
            </div>
          ) : null}
        </IonItem>
      );
    }
    case "table": {
      const columns = readTableColumns(props.columns);
      const rows = readRecords(props.rows);
      const emptyState = uiNodeFromRecord(props.empty_state);
      const realizedEmptyState = emptyState ? realizedNodeIdentity(emptyState, row) : undefined;
      const selectable = selectionIsActive(props.selection);
      const selectedValues = selectedValueSet(props.selection);
      const tableActivation = actionFromValue(props.activation);
      const tableRowAction = actionFromValue(props.row_action);
      const unsupportedProps = [
        tableActivation.id ? "activation" : undefined,
        tableRowAction.id ? "row_action" : undefined
      ].filter(Boolean).join(",");
      const unsupportedPropsAttr = unsupportedProps || undefined;

      if (rows.length === 0) {
        return (
          <div
            className="uinode-table-empty"
            data-ui-node-id={node.id}
            data-unsupported-interaction-props={unsupportedPropsAttr}
            key={node.id}
          >
            {realizedEmptyState
              ? renderNode(realizedEmptyState, store, options, row, form)
              : <div className="uinode-empty-state" role="status"><div className="uinode-empty-state-copy"><h3>No rows</h3></div></div>}
          </div>
        );
      }

      return (
        <div
          className="uinode-table"
          data-ui-node-id={node.id}
          data-unsupported-interaction-props={unsupportedPropsAttr}
          key={node.id}
          role="table"
        >
          <div className="uinode-table-row heading" role="row">
            {columns.map((column) => (
              <div role="columnheader" key={column.key}>
                {column.label}
              </div>
            ))}
          </div>
          {rows.map((tableRow, index) => {
            const rowId = readString(tableRow.id, `${node.id}-${index}`);
            const rowAction = actionFromValue(tableRow.action);
            const selected = isValueSelected(rowId, selectedValues);
            return (
              <div
                aria-selected={selectable ? selected : undefined}
                className={selected ? "uinode-table-row selected" : "uinode-table-row"}
                data-selected={selected ? "true" : undefined}
                role="row"
                key={rowId}
              >
                {columns.map((column) => (
                  <div role="cell" key={column.key}>
                    {String(readRecord(tableRow.cells)[column.key] ?? tableRow[column.key] ?? "")}
                  </div>
                ))}
                {rowAction.id ? (
                  <div className="uinode-table-row-actions" role="cell">
                    {actionButton(rowAction, node, options, "Row action", undefined, true)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }
    case "form": {
      return <UiNodeForm node={node} props={props} store={store} options={options} row={row} key={node.id} />;
    }
    case "form_field": {
      const schema = readRecord(props.schema);
      const schemaKind = readString(schema.kind, "text");
      const controlType = schemaKind === "text" ? "text_input" : schemaKind;
      const controlNode = {
        id: node.id,
        type: controlType,
        props: {
          ...schema,
          value: props.value,
          checked: props.checked,
          selected: props.selected,
          default: props.default,
          disabled: props.disabled,
          loading: props.loading,
          error: props.error
        } as JsonObject
      } as UiNode;
      const realizedControlNode = realizedNodeIdentity(controlNode, row);
      return realizedControlNode ? renderNode(realizedControlNode, store, options, row, form) : null;
    }
    case "text_input":
    case "textarea":
    case "checkbox":
    case "select":
      return renderCoreControl({
        node,
        props,
        form,
        optionNodes: readSlot(node, "options").flatMap((child) =>
          resolveChild(child, store, options, row).map((resolved) => resolved.node)
        )
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
      return (
        <IonModal
          backdropDismiss={false}
          className={`uinode-dialog presentation-${readString(props.presentation, "auto")}`}
          data-ui-node-id={node.id}
          isOpen
          key={node.id}
        >
          <IonToolbar>
            <IonTitle>{readString(props.title)}</IonTitle>
          </IonToolbar>
          <div className="uinode-dialog-body">
            {renderChildren(readSlot(node, "body"), store, options, row, form)}
            {renderChildren(readChildren(node), store, options, row, form)}
          </div>
        </IonModal>
      );
    default:
      return null;
  }
}

export const ionicUiNodeRendererRegistry: UiNodeRendererRegistry = {
  render(snapshot: UiTreeSnapshot, entities: EntityFrameStore, options: UiNodeRenderOptions = {}) {
    const authoredIssue = authoredIdentityIssues(snapshot.root)[0];
    if (authoredIssue) return identityDiagnostic(snapshot, authoredIssue);

    const realizationIssues: IdentityIssue[] = [];
    const root = realizedNodeIdentity(snapshot.root, undefined, { issues: realizationIssues });
    if (realizationIssues[0]) return identityDiagnostic(snapshot, realizationIssues[0]);
    if (!root) {
      return <div className="uinode-fallback" data-unsupported-identity="unresolved" role="note">Unsupported node identity</div>;
    }

    const collision = realizedIdentityIssue(root, entities, options);
    return collision ? identityDiagnostic(snapshot, collision) : renderNode(root, entities, options);
  },
  supports(primitive: string) {
    return supportedPrimitives.has(primitive);
  }
};
