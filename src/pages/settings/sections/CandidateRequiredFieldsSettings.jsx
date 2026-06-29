import { useTranslation } from 'react-i18next'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'

/**
 * Required-fields-per-phase editor. A matrix of built-in candidate fields × phase
 * (Lead/Kandidaat — tenant-configurable). A checked cell marks the field required
 * for that phase; the drawer/create-modal then show a star and block save when empty.
 * Stored tenant-wide in the `/settings` blob under `candidate_required_fields`
 * ({ <phase>: [field_keys] }). Custom-field required-ness lives on the custom field
 * itself (Settings → Custom fields). Backend re-validates (C-29).
 */
const KEY = 'candidate_required_fields'

// Built-in fields (snake_case = backend key) + their candidates-namespace label key.
const FIELDS = [
  { key: 'first_name',     label: 'firstName' },
  { key: 'last_name',      label: 'lastName' },
  { key: 'email',          label: 'email' },
  { key: 'phone',          label: 'phone' },
  { key: 'function_title', label: 'functionTitle' },
  { key: 'date_of_birth',  label: 'dob' },
  { key: 'gender',         label: 'gender' },
  { key: 'street',         label: 'street' },
  { key: 'postal_code',    label: 'postalCode' },
  { key: 'city',           label: 'city' },
]

// Sensible defaults: a Lead needs little, a Kandidaat needs the core contact set.
const DEFAULTS = {
  lead: ['first_name', 'last_name'],
  candidate: ['first_name', 'last_name', 'email', 'phone', 'function_title'],
}

export default function CandidateRequiredFieldsSettings() {
  const { t } = useTranslation(['settings', 'candidates'])
  const { phases } = useLookups()
  const values = useAllSettings()
  const cfg = getJsonSetting(values, KEY, DEFAULTS)

  // Phase columns come from the tenant lookup; fall back to lead/candidate.
  const cols = phases.length ? phases : [{ value: 'lead', label: 'Lead' }, { value: 'candidate', label: 'Kandidaat' }]

  const isReq = (phase, field) => (cfg[phase] ?? []).includes(field)
  // Toggle one field for one phase and persist the whole map (merge-by-key).
  const toggle = (phase, field) => {
    const cur = cfg[phase] ?? []
    const next = cur.includes(field) ? cur.filter(x => x !== field) : [...cur, field]
    saveSettingsKeys({ [KEY]: { ...cfg, [phase]: next } }).catch(() => {})
  }

  const cell = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'center' }
  return (
    <div style={{ maxWidth: 640 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('requiredFields.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('requiredFields.subtitle')}</p>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{t('requiredFields.field')}</th>
              {cols.map(c => (
                <th key={c.value} style={{ ...cell, fontWeight: 600, color: 'var(--text)' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f, i) => (
              <tr key={f.key} style={i === FIELDS.length - 1 ? { } : undefined}>
                <td style={{ ...cell, textAlign: 'left', color: 'var(--text)' }}>{t(`candidates:modal.fields.${f.label}`, { defaultValue: f.label })}</td>
                {cols.map(c => (
                  <td key={c.value} style={cell}>
                    <input type="checkbox" checked={isReq(c.value, f.key)} onChange={() => toggle(c.value, f.key)}
                      aria-label={`${t(`candidates:modal.fields.${f.label}`, { defaultValue: f.label })} — ${c.label}`}
                      style={{ cursor: 'pointer', width: 16, height: 16 }} />
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
