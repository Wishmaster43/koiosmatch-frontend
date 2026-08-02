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
 * namespace under `<i18nKey>.fields.<key>.*`, matching the existing convention.
 * Complex sections keep their own components — this is only for the plumbing-light
 * majority (toggles / numbers / selects / text / colour).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import {
  SettingsScaffold, SettingCardList, SettingRow,
  Toggle, NumberField, TextField, SelectField, ColorField,
} from './SettingsKit'

function FieldControl({ field, value, onChange, t, base }) {
  switch (field.type) {
    case 'toggle':
      // Accessible name (§6): the row's own label text is only visually adjacent,
      // never programmatically associated, so every switch needs its own name.
      return <Toggle checked={!!value} onChange={onChange} ariaLabel={t(`${base}.label`)} />
    case 'select': {
      const options = field.options.map(opt =>
        typeof opt === 'string'
          ? { value: opt, label: t(`${base}.options.${opt}`, opt) }
          : opt)
      return <SelectField value={value} onChange={onChange} options={options} />
    }
    case 'text':
      return <TextField value={value} onChange={onChange} placeholder={t(`${base}.placeholder`, '')} />
    case 'color':
      // Free-text validated colour (CHIPKLEUR-INSTELBAAR-1) — the field itself shows
      // the backend's validation message so a tenant gets a useful error, not a 422.
      return <ColorField value={value} onChange={onChange}
        invalidLabel={t('common.invalidColorValue')} ariaLabel={t(`${base}.label`)} />
    case 'number':
    default:
      return (
        <NumberField value={value} onChange={onChange}
          min={field.min} max={field.max} unit={t(`${base}.unit`, '')} />
      )
  }
}

export default function SchemaSection({ schema }) {
  const { t } = useTranslation('settings')
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

  return (
    <SettingsScaffold
      title={t(schema.titleI18n ?? `${k}.title`)}
      subtitle={opt(schema.subtitleI18n ?? `${k}.subtitle`)}
      maxWidth={schema.maxWidth ?? 720}
      form={form}>
      <SettingCardList>
        {schema.fields.map(field => {
          const base = `${k}.fields.${field.key}`
          return (
            <SettingRow key={field.key}
              label={t(`${base}.label`)}
              description={opt(`${base}.description`)}>
              <FieldControl field={field} value={form.values[field.key]}
                onChange={v => form.set(field.key, v)} t={t} base={base} />
            </SettingRow>
          )
        })}
      </SettingCardList>
    </SettingsScaffold>
  )
}
