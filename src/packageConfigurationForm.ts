import type { ActionBinding } from "./botster/actions";

export type PackageConfigurationField = Record<string, unknown>;

export function configurationFieldType(field: PackageConfigurationField): string {
  return firstString(field.config_type, field.kind) ?? "string";
}

export function configurationSaveAction(
  submitAction: ActionBinding,
  fields: PackageConfigurationField[],
  draft: Record<string, unknown>
): ActionBinding {
  return {
    ...submitAction,
    params: {
      ...submitAction.params,
      values: configurationSubmitValues(fields, draft)
    }
  };
}

export function configurationSubmitValues(
  fields: PackageConfigurationField[],
  draft: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    fields.flatMap<[string, unknown]>((field) => {
      const id = configurationFieldId(field);
      const value = draft[id];
      const configType = configurationFieldType(field);
      if (configType === "secret" && (value === undefined || value === "")) return [];
      if (configType === "secret") return [[id, { type: "secret", state: "write_only" }]];

      return [[id, { type: configType, value: configType === "boolean" ? value === true : value }]];
    })
  );
}

function configurationFieldId(field: PackageConfigurationField): string {
  return firstString(field.id, field.label, field.config_type) ?? JSON.stringify(field);
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
