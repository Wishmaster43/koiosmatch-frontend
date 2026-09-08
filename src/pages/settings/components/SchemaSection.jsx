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
import { useAuth } from '@/context/AuthContext'
import { useSettingsForm } from '../lib/useSettingsForm'
import {
  SettingsScaffold, SettingCardList, SettingRow,
  Toggle, NumberField, TextField, SelectField, ColorField,
} from './SettingsKit'
import JsonField from './JsonField'

// Picks the right input widget for one schema field, by its declared type.
function FieldControl({ field, value, onChange, t, base, label, disabled }) {
  switch (field.type) {
    case 'toggle':
      // Accessible name (§6): the row's own label text is only visually adjacent,
      // never programmatically associated, so every switch needs its own name.
      return <Toggle checked={!!value} onChange={onChange} ariaLabel={label} disabled={disabled} />
    case 'select': {
      const options = field.options.map(opt =>
        typeof opt === 'string'
          ? { value: opt, label: t(`${base}.options.${opt}`, opt) }
          : { value: opt.value, label: t(opt.label, opt.value) })
      return <SelectField value={value} onChange={onChange} options={options} ariaLabel={label} disabled={disabled} />
    }
    case 'text':
      return <TextField value={value} onChange={onChange} placeholder={t(`${base}.placeholder`, '')} disabled={disabled} />
    case 'secret':
      // A secret arrives masked (§1 '••••••••') and is typed blind; an unchanged mask is
      // never posted back (see the save wrapper below).
      return <TextField type="password" value={value} onChange={onChange} placeholder={t(`${base}.placeholder`, '')} disabled={disabled} />
    case 'color':
      // Free-text validated colour (CHIPKLEUR-INSTELBAAR-1) — the field itself shows
      // the backend's validation message so a tenant gets a useful error, not a 422.
      return <ColorField value={value} onChange={onChange}
        invalidLabel={t('common.invalidColorValue')} ariaLabel={label} disabled={disabled} />
    case 'json':
      // Structured value edited as text per its catalogue format (jsonFormat).
      return <JsonField value={value} onChange={onChange} format={field.format} ariaLabel={label}
        placeholder={t(`${base}.placeholder`, '')} invalidLabel={t('catalog.invalidJson')} disabled={disabled} />
    case 'number':
    default:
      return (
        <NumberField value={value} onChange={onChange} ariaLabel={label}
          min={field.min} max={field.max} step={field.step} unit={t(`${base}.unit`, '')} disabled={disabled} />
      )
  }
}

// Renders an entire settings section from its declarative schema: field defaults, the shared settings-form hook, and the scaffold/card chrome.
export default function SchemaSection({ schema }) {
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
  // never the raw key. `opt` collapses a missing translation to undefined.
  const opt = (key) => { const v = t(key); return v === key ? undefined : v }

  // Persist every field except a secret the user did not touch: its value is the
  // server's mask, and writing that back would replace the real secret with dots.
  const saveEditable = () => form.save(
    schema.fields
      .filter(f => f.type !== 'secret' || form.values[f.key] !== form.initial[f.key])
      .map(f => f.key),
  )
  // When user lacks permissions, hide Save and disable all fields.
  const gatedForm = canEdit ? { ...form, save: saveEditable } : { ...form, save: undefined }

  return (
    <SettingsScaffold
      title={t(schema.titleI18n ?? `${k}.title`)}
      subtitle={opt(schema.subtitleI18n ?? `${k}.subtitle`)}
      maxWidth={schema.maxWidth ?? 720}
      form={gatedForm}>
      <SettingCardList>
        {schema.fields.map(field => {
          // A field's own labelKey/helpKey (catalogue rows) wins over the folder convention.
          const base = `${k}.fields.${field.key}`
          const label = t(field.labelKey ?? `${base}.label`)
          return (
            <SettingRow key={field.key}
              label={label}
              description={opt(field.helpKey ?? `${base}.help`)}>
              <FieldControl field={field} value={form.values[field.key]}
                onChange={v => form.set(field.key, v)} t={t} base={base} label={label} disabled={!canEdit} />
            </SettingRow>
          )
        })}
      </SettingCardList>
    </SettingsScaffold>
  )
}
