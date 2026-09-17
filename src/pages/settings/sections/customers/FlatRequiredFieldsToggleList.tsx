/**
 * FlatRequiredFieldsToggleList — one toggle per built-in field for a customer sub-entity
 * that has NO phase axis (Location / Department / Contact), mirroring the backend's
 * `FlatRequiredFieldsGuard` shape: one parameterised component, three entity tokens.
 * The setting is a flat JSON array of field keys under `{entity}_required_fields` —
 * NOT the phase-keyed map the Klant tab uses (CustomerPhaseRequiredFieldsMatrix).
 *
 * No hardcoded seed defaults: an absent setting means the guard's `builtInRequired()`
 * returns `[]`, i.e. genuinely nothing enforced — every toggle starts off, honestly.
 *
 * `fields` now comes from the live field-inventory (VERPLICHTE-VELDEN-INVENTARIS-1) via the
 * container (CustomerRequiredFieldsSettings) rather than the static whitelist directly — a row
 * can carry `requirable:false` (rendered disabled with its `reason` as a hover title, never
 * hidden — Danny wants to SEE what he can't require) alongside the always-requirable ones.
 */
import { useTranslation } from 'react-i18next'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'
import type { RequiredFieldDef } from './requiredFieldsCatalog'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SettingsLoadBanner from '@/pages/settings/components/SettingsLoadBanner'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

export default function FlatRequiredFieldsToggleList({ settingKey, fields, hintKey }: {
  /** The tenant setting key, e.g. `customer_location_required_fields`. */
  settingKey: string
  /** Rows to render — labels resolved against the catalogue, `requirable`/`reason` optional. */
  fields: (RequiredFieldDef & { requirable?: boolean; reason?: string | null })[]
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

  // Keys the inventory currently marks non-requirable — stripped from the stored array
  // on every save, so a key that was required before the inventory turned it off never
  // rides along as a dead "required" the admin can no longer clear (§3 no fake affordance).
  const nonRequirableKeys = new Set(fields.filter(f => f.requirable === false).map(f => f.key))

  // Toggle one field in/out of the flat required-fields array and persist it whole.
  // Ignored while the stored blob hasn't loaded yet, or for a row the inventory marks
  // not requirable (no working guard key — a save would be a documented no-op, §3).
  const toggle = (field: string) => {
    if (!loaded || nonRequirableKeys.has(field)) return
    const cleaned = list.filter(x => !nonRequirableKeys.has(x))
    const next = cleaned.includes(field) ? cleaned.filter(x => x !== field) : [...cleaned, field]
    saveSettingsKeys({ [settingKey]: next }).catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }
  return (
    <div>
      <SettingsLoadBanner />
      {/* Explains the create/update semantics — full check on create, touched-fields-only on update. */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t(hintKey)}</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {fields.map((f, i) => {
          const rowDisabled = !loaded || f.requirable === false
          return (
            <div key={f.key} style={i === fields.length - 1 ? { ...row, borderBottom: 'none' } : row}>
              <span style={{ color: 'var(--text)' }} title={f.requirable === false ? f.reason ?? undefined : undefined}>{t(f.labelKey)}</span>
              <PermissionToggle checked={list.includes(f.key)} onChange={() => toggle(f.key)} aria-label={t(f.labelKey)} disabled={rowDisabled} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
