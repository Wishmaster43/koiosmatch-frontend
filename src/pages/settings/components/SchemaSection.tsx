/**
 * SchemaSection — renders a whole settings section from a declarative schema, so
 * adding a simple setting is one line of data instead of a new component.
 *
 *   { i18nKey: 'display', fields: [
 *       { key: 'top_cities_n', type: 'number', default: 10, min: 1 },
 *       { key: 'show_avatars', type: 'toggle', default: true },
 *   ]}
 *
 * Labels/descriptions/units/option-labels all resolve from the `settings` i18n
 * namespace under `<i18nKey>.fields.<key>.*`, matching the existing convention; a
 * field may carry its own `labelKey`/`helpKey` instead (the catalogue screens,
 * DRAFT-SETTINGS-CATALOG-1 §1). Complex sections keep their own components — this is
 * only for the plumbing-light majority (toggles / numbers / selects / text / colour /
 * secret / json).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '@/context/AuthContext'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SlidersHorizontal } from 'lucide-react'
import { SectionTitle } from '@/components/ui/typography'
import { lucideByName } from '@/lib/lucideByName'
import {
  SettingsScaffold, SettingCardList, SettingRow,
  Toggle, NumberField, TextField, SelectField, ColorField,
} from './SettingsKit'
import JsonField from './JsonField'
import type { JsonFormat } from '../catalog/jsonFormat'

// One field in a declarative schema — `type` selects the FieldControl widget below.
export interface SchemaField {
  key: string
  type?: 'toggle' | 'select' | 'text' | 'secret' | 'color' | 'json' | 'number'
  default?: unknown
  options?: Array<string | { value: string; label: string }>
  min?: number
  max?: number
  step?: number
  format?: string
  group?: string
  labelKey?: string
  helpKey?: string
  // O23 UNIT-NAAST-BEDRAG-1: a select that renders inline right of the number field
  // it names (the value here is that field's key), never as its own SettingRow.
  unitOf?: string
}
// One grouped block of fields (CATALOG-GROUPS-1), headed by its own icon + label.
export interface SchemaGroup { key: string; icon?: string | null; labelKey: string }
// A whole settings-section schema, as passed to SchemaSection.
export interface Schema {
  i18nKey: string
  fields: SchemaField[]
  groups?: SchemaGroup[]
  titleI18n?: string
  subtitleI18n?: string
  maxWidth?: number
  sectionId?: string
  color?: string | null
}

// i18n runs with returnEmptyString:false (see the `opt` comment below) — that setting
// also swallows an explicit '' defaultValue passed as t(key, ''), so a missing
// placeholder/unit key echoed the raw key back into the UI (Danny 13-09, row 2.2:
// company/billing_email showed "catalog.sections.company.fields.billing_email.placeholder"
// as its placeholder). Compare the result against the key instead — the same trick the
// unit lookup already used inline — so a field with nothing translated renders nothing.
function optionalT(t: TFunction, key: string): string | undefined {
  const v = t(key)
  return v === key ? undefined : v
}

// Picks the right input widget for one schema field, by its declared type.
interface FieldControlProps {
  field: SchemaField
  value: unknown
  onChange: (value: unknown) => void
  t: TFunction
  base: string
  label: string
  disabled: boolean
  // O23: a companion unit picker sits beside this number field — omit the static
  // unit suffix text then, the picker itself already says the unit.
  hideUnit?: boolean
}
function FieldControl({ field, value, onChange, t, base, label, disabled, hideUnit }: FieldControlProps) {
  switch (field.type) {
    case 'toggle':
      // Accessible name (§6): the row's own label text is only visually adjacent,
      // never programmatically associated, so every switch needs its own name.
      return <Toggle checked={!!value} onChange={onChange} ariaLabel={label} disabled={disabled} />
    case 'select': {
      const options = (field.options ?? []).map(opt =>
        typeof opt === 'string'
          ? { value: opt, label: t(`${base}.options.${opt}`, opt) }
          : { value: opt.value, label: t(opt.label, opt.value) })
      // DROPDOWN-CLEAR-1: a companion unit field (unitOf) pairs with a required
      // amount and must never persist empty — non-clearable, unlike a plain select.
      return <SelectField value={String(value)} onChange={onChange} options={options} ariaLabel={label}
        disabled={disabled} clearable={!field.unitOf} />
    }
    case 'text':
      return <TextField value={value as string} onChange={onChange} placeholder={optionalT(t, `${base}.placeholder`)} disabled={disabled} />
    case 'secret':
      // A secret arrives masked (§1 '••••••••') and is typed blind; an unchanged mask is
      // never posted back (see the save wrapper below).
      return <TextField type="password" value={value as string} onChange={onChange} placeholder={optionalT(t, `${base}.placeholder`)} disabled={disabled} />
    case 'color':
      // Free-text validated colour (CHIPKLEUR-INSTELBAAR-1) — the field itself shows
      // the backend's validation message so a tenant gets a useful error, not a 422.
      return <ColorField value={value as string | undefined} onChange={onChange}
        invalidLabel={t('common.invalidColorValue')} ariaLabel={label} disabled={disabled} />
    case 'json':
      // Structured value edited as text per its catalogue format (jsonFormat).
      return <JsonField value={value} onChange={onChange} format={field.format as JsonFormat} ariaLabel={label}
        placeholder={optionalT(t, `${base}.placeholder`)} invalidLabel={t('catalog.invalidJson')} disabled={disabled} />
    case 'number':
    default:
      return (
        <NumberField value={value as number} onChange={onChange} ariaLabel={label}
          min={field.min} max={field.max} step={field.step}
          unit={hideUnit ? undefined : optionalT(t, `${base}.unit`)} disabled={disabled} />
      )
  }
}

// Renders an entire settings section from its declarative schema: field defaults, the shared settings-form hook, and the scaffold/card chrome.
interface SchemaSectionProps { schema: Schema; embedded?: boolean }
export default function SchemaSection({ schema, embedded = false }: SchemaSectionProps) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  // Build the field-key → default-value map once per schema, seeding useSettingsForm.
  const defaults = useMemo(
    () => Object.fromEntries(schema.fields.map(f => [f.key, f.default])),
    [schema],
  )
  const form = useSettingsForm(defaults)
  const k = schema.i18nKey
  // i18n runs with returnEmptyString:false, so t() echoes the key back when there is
  // no translation. Optional text (subtitle/description) must show NOTHING then —
  // never the raw key. `opt` delegates to the same optionalT the field placeholders/units use.
  const opt = (key: string) => optionalT(t, key)

  // Persist every field except a secret the user did not touch: its value is the
  // server's mask, and writing that back would replace the real secret with dots.
  const saveEditable = () => form.save(
    schema.fields
      .filter(f => f.type !== 'secret' || form.values[f.key] !== form.initial[f.key])
      .map(f => f.key),
  )
  // When user lacks permissions, hide Save and disable all fields.
  // An EMBEDDED block shows its Save only once it is dirty — the host screen's own Save
  // stays the one button at rest, so a second "Opslaan" never sits next to it unasked.
  const gatedForm = canEdit ? { ...form, save: embedded && !form.dirty ? undefined : saveEditable } : { ...form, save: undefined }

  // One row per field; the label/help keys come from the field (catalogue rows) or the folder convention.
  // O23 UNIT-NAAST-BEDRAG-1: a companion unit field (`unitOf` pointing back at this
  // one) never gets its own row — it renders inline right of the amount instead.
  const renderRow = (field: SchemaField) => {
    if (field.unitOf) return null
    const base = `${k}.fields.${field.key}`
    const label = t(field.labelKey ?? `${base}.label`)
    const unitField = schema.fields.find(f => f.unitOf === field.key)
    return (
      <SettingRow key={field.key}
        label={label}
        description={opt(field.helpKey ?? `${base}.help`)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FieldControl field={field} value={form.values[field.key]}
            onChange={v => form.set(field.key, v)} t={t} base={base} label={label}
            disabled={!canEdit} hideUnit={!!unitField} />
          {unitField && (
            <FieldControl field={unitField} value={form.values[unitField.key]}
              onChange={v => form.set(unitField.key, v)} t={t} base={`${k}.fields.${unitField.key}`}
              label={t(unitField.labelKey ?? `${k}.fields.${unitField.key}.label`)}
              disabled={!canEdit} />
          )}
        </div>
      </SettingRow>
    )
  }
  // CATALOG-GROUPS-1 (Danny 10-09: "zorg dat de goed staan onderverdeeld"): blocks in the
  // section's order, each headed by its group icon in the section colour + translated name;
  // fields the contract has not grouped yet render as one headless list (never a "rest" block).
  const groups = schema.groups?.length ? schema.groups : []
  const grouped = new Set(groups.map(g => g.key))
  const ungrouped = schema.fields.filter(f => !f.group || !grouped.has(f.group))

  return (
    <SettingsScaffold
      title={embedded ? undefined : t(schema.titleI18n ?? `${k}.title`)}
      subtitle={embedded ? undefined : opt(schema.subtitleI18n ?? `${k}.subtitle`)}
      maxWidth={schema.maxWidth ?? 720}
      form={gatedForm}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {groups.map(group => {
          const fields = schema.fields.filter(f => f.group === group.key)
          if (fields.length === 0) return null
          const Icon = lucideByName(group.icon, SlidersHorizontal)
          // F6 (Opus review 13-09): the DOM id is namespaced by SECTION + group, not
          // the bare group slug — two different sections can share a group slug (e.g.
          // "windows/candidates" and "retention/candidates"), and a host embedding
          // both would otherwise collide on the same aria-labelledby/id.
          const domId = `catalog-group-${schema.sectionId ?? ''}-${group.key}`
          return (
            <section key={group.key} aria-labelledby={domId}>
              <SectionTitle as="h3" id={domId}
                style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' }}>
                <Icon size={14} color={schema.color ?? 'var(--color-primary-text)'} aria-hidden="true" />
                {t(group.labelKey)}
              </SectionTitle>
              <SettingCardList>{fields.map(renderRow)}</SettingCardList>
            </section>
          )
        })}
        {ungrouped.length > 0 && <SettingCardList>{ungrouped.map(renderRow)}</SettingCardList>}
      </div>
    </SettingsScaffold>
  )
}
