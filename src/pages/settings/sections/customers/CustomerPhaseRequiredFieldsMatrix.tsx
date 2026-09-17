/**
 * CustomerPhaseRequiredFieldsMatrix — required-built-in-fields-per-phase editor for the
 * Customer entity itself (KLANT-VERPLICHT-1). Mirrors CandidateRequiredFieldsSettings'
 * exact table + PermissionToggle shape — the established pattern in this codebase for
 * "required field x phase" — with two differences: the field ROWS come from the live
 * `GET /settings/field-inventory?entity=customer` catalogue (VERPLICHTE-VELDEN-INVENTARIS-1,
 * useFieldInventory — replaces the static CUSTOMER_FIELDS whitelist mirror) and the COLUMNS
 * come from the REAL tenant lookup (useCustomerPhases), never a hardcoded Prospect/Klant pair.
 * Persisted in the shared `/settings` blob under `customer_required_fields` as
 * `{ <phase>: [field_keys] }` — exactly the shape `CustomerRequiredFieldsGuard.php` reads.
 *
 * No hardcoded seed defaults (unlike the candidate screen's DEFAULTS map): the backend
 * guard falls back to an EMPTY required set per phase when the setting key is absent
 * (`$config[$phase] ?? []`), so "every toggle off" is the honestly-in-effect state, not
 * a placeholder — showing anything else here would misrepresent what is actually enforced.
 */
import { useTranslation } from 'react-i18next'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useFieldInventory } from '@/pages/settings/hooks/useFieldInventory'
import { useSafePermission } from '@/hooks/useSafePermission'
import { RequiredFieldsMatrixTable } from '@/pages/settings/components/RequiredFieldsMatrixTable'
import { CUSTOMER_FIELD_LABEL_KEYS } from './requiredFieldsCatalog'
import { buildInventoryRows, togglePhaseKeyedField } from '@/pages/settings/requiredFieldsReason'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SettingsLoadBanner from '@/pages/settings/components/SettingsLoadBanner'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

const KEY = 'customer_required_fields'

// The required-fields-per-phase matrix for customers.
export default function CustomerPhaseRequiredFieldsMatrix() {
  const { t } = useTranslation(['settings', 'customers'])
  const { phases } = useCustomerPhases()
  const hasPermission = useSafePermission()
  const { fields: inventoryFields, isLoading, isError, refetch } = useFieldInventory('customer')
  const values = useAllSettings()
  // REQFIELDS-TOGGLE-RACE-1: a click before GET /settings resolves would rebuild
  // the WHOLE phase map from the {} fallback and wipe every phase's list — worse
  // than the flat variant. Toggles stay inert until the real blob has loaded.
  const loaded = useSettingsLoaded()
  const cfg = getJsonSetting<Record<string, string[]>>(values, KEY, {})

  // Row source: the live inventory, filtered on `requires_permission`; label reuses the
  // existing screen/drawer i18n key from the catalogue map, falling back to the raw key
  // when the map lacks it (a gap is reported by the lane, not surfaced at runtime) — the
  // shared builder also translates the raw English `reason` (§11, shared with the flat tabs).
  const rows = buildInventoryRows(inventoryFields, CUSTOMER_FIELD_LABEL_KEYS, hasPermission, t)

  // Keys the inventory currently marks non-requirable — stripped from every phase on
  // every save, so a stored no-op the admin can no longer clear never rides along
  // invisibly (§3 no fake affordance; mirrors CandidateRequiredFieldsSettings).
  const nonRequirableKeys = new Set(inventoryFields.filter(f => !f.requirable).map(f => f.key))

  // Required-set membership for one phase/field cell, and a toggle that persists the
  // whole map (merge-by-phase) — mirrors CandidateRequiredFieldsSettings' toggle().
  const isReq = (phase: string, field: string) => (cfg[phase] ?? []).includes(field)
  // Flips one field's required-membership for a phase and persists the merged map;
  // no-ops before the settings blob has loaded (see REQFIELDS-TOGGLE-RACE-1 above).
  const toggle = (phase: string, field: string) => {
    // A non-requirable inventory row has no working guard key — a save for it is a
    // documented no-op on the backend, so the UI never even offers it (§3 no fake affordance).
    if (!loaded || nonRequirableKeys.has(field)) return
    const next = togglePhaseKeyedField(cfg, phase, field, nonRequirableKeys)
    saveSettingsKeys({ [KEY]: next }).catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // Four UI states: an inventory load failure blocks the matrix with a retry, never a
  // silent empty table; an empty inventory (no fields at all) says so honestly.
  if (isLoading) return <div style={{ padding: 24, textAlign: 'center' }}><Spinner label={t('common:loading')} /></div>
  if (isError) return <ErrorBanner onRetry={() => { void refetch() }}>{t('requiredFields.inventoryLoadFailed')}</ErrorBanner>

  return (
    <div>
      <SettingsLoadBanner />
      {/* Explains the create/update semantics — an ordinary edit that never changes
          phase is never blocked, however incomplete the record already is otherwise. */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('customerRequiredFields.phaseHint')}</p>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('customerRequiredFields.empty')}</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
          <RequiredFieldsMatrixTable fields={rows} phases={phases.map(p => ({ value: String(p.value), label: p.label }))}
            isRequired={isReq} onToggle={toggle} disabled={!loaded} headerRowStyle={{ background: 'var(--bg)' }} />
        </div>
      )}
    </div>
  )
}
