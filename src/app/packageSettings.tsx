/** Package settings panel and configuration form controls. */

import {
  IonBadge,
  IonButton,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea
} from "@ionic/react";
import {
  constructOutline,
  keyOutline,
  openOutline,
  powerOutline,
  refreshOutline,
  serverOutline
} from "ionicons/icons";
import { useCallback, useMemo, useState } from "react";

import type { ActionBinding } from "../botster/actions";
import { configurationFieldType, configurationSaveAction } from "../packageConfigurationForm";
import {
  capabilityCountLabel,
  packageActionBinding,
  packageActionDetail,
  packageActionKey,
  packageActions,
  packageSettingsSurfaces,
  type PackageSurfaceRecord,
  surfaceDescription,
  surfaceKey,
  surfaceLaunchAction,
  surfaceTitle
} from "./packageSurfaces";
import { arrayOfStrings, firstString, stringValue } from "./values";

function packageActionIcon(record: PackageSurfaceRecord): string {
  const actionId = stringValue(record.action_id, "");
  if (actionId.includes("update")) return openOutline;
  if (actionId.includes("enable") || actionId.includes("disable") || actionId.includes("start") || actionId.includes("stop")) return powerOutline;
  if (actionId.includes("reload") || actionId.includes("restart")) return refreshOutline;
  return constructOutline;
}

function packageSurfaceRecords(value: unknown): PackageSurfaceRecord[] {
  return Array.isArray(value)
    ? value.filter((surface): surface is PackageSurfaceRecord => Boolean(surface && typeof surface === "object" && !Array.isArray(surface)))
    : [];
}

interface PluginSettingsPanelProps {
  app: Record<string, unknown>;
  onAction: (action: ActionBinding) => void;
  onOpenSurface?: (surface: PackageSurfaceRecord) => void;
}

export function PluginSettingsPanel({ app, onAction, onOpenSurface }: PluginSettingsPanelProps) {
  const settingsSurfaces = packageSettingsSurfaces(app);
  const actions = packageActions(app);
  const configurationFields = useMemo(() => packageSurfaceRecords(app.configuration_fields), [app.configuration_fields]);
  const remoteAccessField = useMemo(
    () => configurationFields.find((field) => firstString(field.id) === "remote_browser_rendezvous_enabled"),
    [configurationFields]
  );
  const genericConfigurationFields = useMemo(
    () => configurationFields.filter((field) => firstString(field.id) !== "remote_browser_rendezvous_enabled"),
    [configurationFields]
  );
  const configurationSubmit = packageActionFromValue(app.configuration_submit);
  const configurationDraftBaseline = useMemo(
    () => configurationDraftValues(genericConfigurationFields),
    [genericConfigurationFields]
  );
  const configurationDraftBaselineKey = JSON.stringify(configurationDraftBaseline);

  return (
    <IonList lines="full">
      {configurationFields.length > 0 ? (
        <>
          <IonListHeader>
            <IonLabel>Package configuration</IonLabel>
          </IonListHeader>
          {remoteAccessField ? (
            <RemoteAccessConfigurationItem
              field={remoteAccessField}
              submit={configurationSubmit}
              onAction={onAction}
            />
          ) : null}
          {genericConfigurationFields.length > 0 ? (
            <GenericConfigurationForm
              fields={genericConfigurationFields}
              key={configurationDraftBaselineKey}
              onAction={onAction}
              submit={configurationSubmit}
            />
          ) : null}
        </>
      ) : null}
      {settingsSurfaces.length > 0 ? (
        settingsSurfaces.map((surface) => {
          const launchAction = surfaceLaunchAction(surface);
          return (
            <IonItem
              button
              key={surfaceKey(surface)}
              disabled={!launchAction}
              onClick={() => {
                if (onOpenSurface) {
                  onOpenSurface(surface);
                } else if (launchAction) {
                  onAction(launchAction);
                }
              }}
            >
              <IonIcon slot="start" icon={constructOutline} aria-hidden="true" />
              <IonLabel>
                <h2>{surfaceTitle(surface)}</h2>
                <p>{surfaceDescription(surface) ?? `${capabilityCountLabel(app.capability_summary)} capabilities`}</p>
              </IonLabel>
            </IonItem>
          );
        })
      ) : null}
      {actions.map((record) => {
        const action = packageActionBinding(record);
        return (
          <IonItem
            button
            disabled={!action || action.disabled === true}
            key={packageActionKey(record)}
            onClick={() => {
              if (action) onAction(action);
            }}
          >
            <IonIcon slot="start" icon={packageActionIcon(record)} aria-hidden="true" />
            <IonLabel>
              <h2>{stringValue(action?.label, stringValue(record.action_id, "Package action"))}</h2>
              <p>{packageActionDetail(record)}</p>
            </IonLabel>
          </IonItem>
        );
      })}
    </IonList>
  );
}

function GenericConfigurationForm({
  fields,
  submit,
  onAction
}: {
  fields: PackageSurfaceRecord[];
  submit: ActionBinding | undefined;
  onAction: (action: ActionBinding) => void;
}) {
  const [configurationDraft, setConfigurationDraft] = useState<Record<string, unknown>>(() => configurationDraftValues(fields));

  const updateConfigurationField = useCallback((field: PackageSurfaceRecord, value: unknown) => {
    const id = configurationFieldId(field);
    setConfigurationDraft((currentValues) => ({ ...currentValues, [id]: value }));
  }, []);

  const saveConfiguration = useCallback(() => {
    if (!submit) return;

    onAction(configurationSaveAction(submit, fields, configurationDraft));
  }, [submit, fields, configurationDraft, onAction]);

  return (
    <>
      {fields.map((field) => (
        <ConfigurationFieldItem
          field={field}
          key={configurationFieldKey(field)}
          onChange={updateConfigurationField}
          value={configurationDraft[configurationFieldId(field)]}
        />
      ))}
      <IonItem>
        <IonButton
          data-testid="package-configuration-save"
          disabled={!submit || submit.disabled === true}
          onClick={saveConfiguration}
          slot="end"
        >
          {submit?.label ?? "Save configuration"}
        </IonButton>
      </IonItem>
    </>
  );
}

export function RemoteAccessConfigurationItem({
  field,
  submit,
  onAction
}: {
  field: PackageSurfaceRecord;
  submit: ActionBinding | undefined;
  onAction: (action: ActionBinding) => void;
}) {
  const enabled = field.value === true;
  const nextEnabled = !enabled;
  const disabled = !submit || submit.disabled === true;
  const errors = arrayOfStrings(field.errors);

  return (
    <IonItem>
      <IonIcon slot="start" icon={serverOutline} aria-hidden="true" />
      <IonLabel>
        <h2>Remote browser access</h2>
        <p>{enabled ? "Remote browser rendezvous is opted in." : "Remote browser rendezvous is off."}</p>
        <p>Local installed access stays available. Remote access requires opt-in, pairing, and device approval.</p>
        {errors.map((error) => (
          <IonNote color="danger" key={error}>
            {error}
          </IonNote>
        ))}
      </IonLabel>
      <IonBadge slot="end" color={enabled ? "success" : "medium"}>
        {enabled ? "Opted in" : "Off"}
      </IonBadge>
      <IonButton
        slot="end"
        fill={enabled ? "outline" : "solid"}
        disabled={disabled}
        onClick={() => {
          if (!submit) return;
          onAction({
            ...submit,
            params: {
              ...submit.params,
              values: {
                remote_browser_rendezvous_enabled: {
                  type: "boolean",
                  value: nextEnabled
                }
              }
            }
          });
        }}
      >
        {enabled ? "Opt out" : "Opt in"}
      </IonButton>
    </IonItem>
  );
}

function ConfigurationFieldItem({
  field,
  onChange,
  value
}: {
  field: PackageSurfaceRecord;
  onChange: (field: PackageSurfaceRecord, value: unknown) => void;
  value: unknown;
}) {
  const label = firstString(field.label, field.id) ?? "Configuration field";
  const kind = firstString(field.config_type, field.kind) ?? "string";
  const helper = firstString(field.helper, field.placeholder);
  const errors = configurationFieldErrors(field);
  const required = field.required === true;

  return (
    <IonItem>
      <IonIcon slot="start" icon={keyOutline} aria-hidden="true" />
      <IonLabel>
        <h2>{required ? `${label} *` : label}</h2>
        <p>{kind}</p>
        {helper ? <p>{helper}</p> : null}
        {errors.map((error) => (
          <IonNote color="danger" key={error}>
            {error}
          </IonNote>
        ))}
      </IonLabel>
      <ConfigurationFieldControl field={field} onChange={onChange} value={value} />
      {configurationFieldSecretRedacted(field) && !value ? <IonBadge slot="end" color="medium">Secret saved</IonBadge> : null}
    </IonItem>
  );
}

function ConfigurationFieldControl({
  field,
  onChange,
  value
}: {
  field: PackageSurfaceRecord;
  onChange: (field: PackageSurfaceRecord, value: unknown) => void;
  value: unknown;
}) {
  const kind = formControlKind(field);
  const placeholder = firstString(field.placeholder);
  const label = firstString(field.label, field.id) ?? "Configuration field";
  const fieldId = configurationFieldId(field);

  if (kind === "checkbox") {
    return (
      <IonCheckbox
        aria-label={label}
        checked={value === true}
        data-configuration-field={fieldId}
        onIonChange={(event) => onChange(field, event.detail.checked === true)}
        slot="end"
      />
    );
  }

  if (kind === "select") {
    return (
      <IonSelect
        aria-label={label}
        data-configuration-field={fieldId}
        interface="popover"
        onIonChange={(event) => onChange(field, event.detail.value ?? "")}
        placeholder={placeholder}
        slot="end"
        value={value}
      >
        {configurationFieldOptions(field).map((option) => (
          <IonSelectOption key={option.value} value={option.value}>
            {option.label}
          </IonSelectOption>
        ))}
      </IonSelect>
    );
  }

  if (kind === "textarea") {
    return (
      <IonTextarea
        aria-label={label}
        data-configuration-field={fieldId}
        onIonInput={(event) => onChange(field, event.detail.value ?? "")}
        placeholder={placeholder}
        slot="end"
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  return (
    <IonInput
      aria-label={label}
      data-configuration-field={fieldId}
      onIonInput={(event) => onChange(field, event.detail.value ?? "")}
      placeholder={placeholder}
      slot="end"
      type={kind === "secret" ? "password" : "text"}
      value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
    />
  );
}

function configurationFieldKey(field: PackageSurfaceRecord): string {
  return firstString(field.id, field.label, field.config_type) ?? JSON.stringify(field);
}

function configurationFieldId(field: PackageSurfaceRecord): string {
  return firstString(field.id, field.label, field.config_type) ?? JSON.stringify(field);
}

function configurationDraftValues(fields: PackageSurfaceRecord[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [configurationFieldId(field), configurationFieldValue(field)]));
}

function configurationFieldValue(field: PackageSurfaceRecord): unknown {
  if (formControlKind(field) === "checkbox") return field.value === true;
  if (typeof field.value === "string" || typeof field.value === "number" || typeof field.value === "boolean") return field.value;
  return "";
}

function formControlKind(field: PackageSurfaceRecord): string {
  const configType = configurationFieldType(field);
  if (configType === "multiline_text") return "textarea";
  if (configType === "boolean") return "checkbox";
  if (configType === "select") return "select";
  if (configType === "secret") return "secret";
  return firstString(field.kind) ?? "text_input";
}

function configurationFieldOptions(field: PackageSurfaceRecord): Array<{ value: string; label: string }> {
  return packageSurfaceRecords(field.options).map((option) => ({
    value: stringValue(option.value, ""),
    label: stringValue(option.label, stringValue(option.value, ""))
  })).filter((option) => option.value.length > 0);
}

function configurationFieldErrors(field: PackageSurfaceRecord): string[] {
  return arrayOfStrings(field.errors);
}

function configurationFieldSecretRedacted(field: PackageSurfaceRecord): boolean {
  return configurationFieldType(field) === "secret" && field.secret_state === "redacted";
}

function packageActionFromValue(value: unknown): ActionBinding | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ActionBinding) : undefined;
}
