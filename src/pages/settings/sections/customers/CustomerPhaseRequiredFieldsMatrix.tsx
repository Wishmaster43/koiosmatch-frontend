/**
 * CustomerPhaseRequiredFieldsMatrix — required-built-in-fields-per-phase editor for the
 * Customer entity itself (KLANT-VERPLICHT-1). Mirrors CandidateRequiredFieldsSettings'
 * exact table + PermissionToggle shape — the established pattern in this codebase for
 * "required field x phase" — with two differences: the field catalog is the customer
 * whitelist (requiredFieldsCatalog.ts) and the columns come from the REAL tenant lookup
 * (useCustomerPhases), never a hardcoded Prospect/Klant pair. Persisted in the shared
 * `/settings` blob under `customer_required_fields` as `{ <phase>: [field_keys] }` —
 * exactly the shape `CustomerRequiredFieldsGuard.php` reads on the backend.
 *
 * No hardcoded seed defaults (unlike the candidate screen's DEFAULTS map): the backend
 * guard falls back to an EMPTY required set per phase when the setting key is absent
 * (`$config[$phase] ?? []`), so "every toggle off" is the honestly-in-effect state, not
 * a placeholder — showing anything else here would misrepresent what is actually enforced.
 */
import { useTranslation } from 'react-i18next'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'
import { CUSTOMER_FIELDS } from './requiredFieldsCatalog'

const KEY = 'customer_required_fields'

// The required-fields-per-phase matrix for customers.
export default function CustomerPhaseRequiredFieldsMatrix() {
  const { t } = useTranslation(['settings', 'customers'])
  const { phases } = useCustomerPhases()
  const values = useAllSettings()
  // REQFIELDS-TOGGLE-RACE-1: a click before GET /settings resolves would rebuild
  // the WHOLE phase map from the {} fallback and wipe every phase's list — worse
  // than the flat variant. Toggles stay inert until the real blob has loaded.
  const loaded = useSettingsLoaded()
  const cfg = getJsonSetting<Record<string, string[]>>(values, KEY, {})

  // Required-set membership for one phase/field cell, and a toggle that persists the
  // whole map (merge-by-phase) — mirrors CandidateRequiredFieldsSettings' toggle().
  const isReq = (phase: string, field: string) => (cfg[phase] ?? []).includes(field)
  // Flips one field's required-membership for a phase and persists the merged map;
  // no-ops before the settings blob has loaded (see REQFIELDS-TOGGLE-RACE-1 above).
  const toggle = (phase: string, field: string) => {
    if (!loaded) return
    const cur = cfg[phase] ?? []
    const next = cur.includes(field) ? cur.filter(x => x !== field) : [...cur, field]
    saveSettingsKeys({ [KEY]: { ...cfg, [phase]: next } }).catch(() => {})
  }

  const cell = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'center' as const }
  return (
    <div>
      {/* Explains the create/update semantics — an ordinary edit that never changes
          phase is never blocked, however incomplete the record already is otherwise. */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('customerRequiredFields.phaseHint')}</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{t('requiredFields.field')}</th>
              {phases.map(p => (
                <th key={String(p.value)} style={{ ...cell, fontWeight: 600, color: 'var(--text)' }}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CUSTOMER_FIELDS.map(f => (
              <tr key={f.key}>
                <td style={{ ...cell, textAlign: 'left', color: 'var(--text)' }}>{t(f.labelKey)}</td>
                {phases.map(p => (
                  <td key={String(p.value)} style={cell}>
                    <PermissionToggle checked={isReq(String(p.value), f.key)} onChange={() => toggle(String(p.value), f.key)}
                      disabled={!loaded} aria-label={`${t(f.labelKey)} — ${p.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
