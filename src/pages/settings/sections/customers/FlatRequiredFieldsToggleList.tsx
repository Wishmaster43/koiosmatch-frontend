/**
 * FlatRequiredFieldsToggleList — one toggle per built-in field for a customer sub-entity
 * that has NO phase axis (Locatie / Afdeling / Contactpersoon), mirroring the backend's
 * `FlatRequiredFieldsGuard` shape: one parameterised component, three entity tokens.
 * The setting is a flat JSON array of field keys under `{entity}_required_fields` —
 * NOT the phase-keyed map the Klant tab uses (CustomerPhaseRequiredFieldsMatrix).
 *
 * No hardcoded seed defaults: an absent setting means the guard's `builtInRequired()`
 * returns `[]`, i.e. genuinely nothing enforced — every toggle starts off, honestly.
 */
import { useTranslation } from 'react-i18next'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'
import type { RequiredFieldDef } from './requiredFieldsCatalog'

export default function FlatRequiredFieldsToggleList({ settingKey, fields, hintKey }: {
  /** The tenant setting key, e.g. `customer_location_required_fields`. */
  settingKey: string
  /** The whitelist for this entity (requiredFieldsCatalog.ts). */
  fields: RequiredFieldDef[]
  /** i18n key for the create/update-semantics helper line above the list. */
  hintKey: string
}) {
  const { t } = useTranslation(['settings', 'customers'])
  const values = useAllSettings()
  // REQFIELDS-TOGGLE-RACE-1: useAllSettings() returns `{}` before the GET /settings
  // resolves, indistinguishable from a genuinely empty stored list. Without this
  // guard, a click that lands before the fetch resolves builds `next` from that `[]`
  // fallback and POSTs it, silently wiping the tenant's real stored array. Rows stay
  // visible (§3: never a blank screen) but inert until the real blob has loaded.
  const loaded = useSettingsLoaded()
  const list = getJsonSetting<string[]>(values, settingKey, [])

  // Toggle one field in/out of the flat required-fields array and persist it whole.
  // Ignored while the stored blob hasn't loaded yet — see the race note above.
  const toggle = (field: string) => {
    if (!loaded) return
    const next = list.includes(field) ? list.filter(x => x !== field) : [...list, field]
    saveSettingsKeys({ [settingKey]: next }).catch(() => {})
  }

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }
  return (
    <div>
      {/* Explains the create/update semantics — full check on create, touched-fields-only on update. */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t(hintKey)}</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {fields.map((f, i) => (
          <div key={f.key} style={i === fields.length - 1 ? { ...row, borderBottom: 'none' } : row}>
            <span style={{ color: 'var(--text)' }}>{t(f.labelKey)}</span>
            <PermissionToggle checked={list.includes(f.key)} onChange={() => toggle(f.key)} aria-label={t(f.labelKey)} disabled={!loaded} />
          </div>
        ))}
      </div>
    </div>
  )
}
