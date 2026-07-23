import { useTranslation } from 'react-i18next'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'
import { getVacancyTabDefaults } from '@/pages/candidates/lib/vacancyTabVisibility'
import { ColorBadge } from '../components/SettingsControls'

/**
 * Vacatures-tab visibility editor (Danny 23-07): the candidate drawer's
 * "Vacatures" (vacancySearch) tab is tenant-configurable per candidate PHASE
 * (which phases show it) and per deployability STATUS (which statuses hide it),
 * e.g. off by default for a Lead or an Unavailable candidate. Stored tenant-wide
 * in the `/settings` blob under `candidate_vacancy_tab`
 * ({ phases: string[], hidden_statuses: string[] }); both arrays are always
 * persisted together so a later lookup addition never silently flips behaviour.
 * The drawer reads the same key via `isVacancyTabVisible` (vacancyTabVisibility.ts).
 */
const KEY = 'candidate_vacancy_tab'

export default function CandidateVacancyTabSettings() {
  const { t } = useTranslation('settings')
  const { phases, statuses } = useLookups()
  const values = useAllSettings()
  const stored = getJsonSetting(values, KEY, null)
  // Absent setting → show the real seed-based effective behaviour, never a blank form.
  const defaults = getVacancyTabDefaults(phases, statuses)
  const cfg = {
    phases: stored?.phases ?? defaults.phases,
    hidden_statuses: stored?.hidden_statuses ?? defaults.hidden_statuses,
  }

  // Toggle whether the tab is VISIBLE for one phase; persists BOTH arrays explicitly.
  const togglePhase = (value) => {
    const next = cfg.phases.includes(value) ? cfg.phases.filter(v => v !== value) : [...cfg.phases, value]
    saveSettingsKeys({ [KEY]: { phases: next, hidden_statuses: cfg.hidden_statuses } }).catch(() => {})
  }
  // Toggle whether the tab is HIDDEN for one status; persists BOTH arrays explicitly.
  const toggleHiddenStatus = (value) => {
    const next = cfg.hidden_statuses.includes(value) ? cfg.hidden_statuses.filter(v => v !== value) : [...cfg.hidden_statuses, value]
    saveSettingsKeys({ [KEY]: { phases: cfg.phases, hidden_statuses: next } }).catch(() => {})
  }

  const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)' }
  const block = { border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }

  return (
    <div style={{ maxWidth: 480 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('vacancyTab.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('vacancyTab.subtitle')}</p>

      <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('vacancyTab.phasesTitle')}</h4>
      <div style={block}>
        {phases.map((p, i) => (
          <label key={p.value} style={i === phases.length - 1 ? { ...row, borderBottom: 'none' } : row}>
            <input type="checkbox" checked={cfg.phases.includes(p.value)} onChange={() => togglePhase(p.value)}
              style={{ cursor: 'pointer', width: 16, height: 16 }} />
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <ColorBadge label={p.label} color={p.color ?? '#6B7280'} />
          </label>
        ))}
      </div>

      <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('vacancyTab.statusesTitle')}</h4>
      <div style={block}>
        {statuses.map((s, i) => (
          <label key={s.value} style={i === statuses.length - 1 ? { ...row, borderBottom: 'none' } : row}>
            <input type="checkbox" checked={cfg.hidden_statuses.includes(s.value)} onChange={() => toggleHiddenStatus(s.value)}
              style={{ cursor: 'pointer', width: 16, height: 16 }} />
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <ColorBadge label={s.label} color={s.color ?? '#6B7280'} />
          </label>
        ))}
      </div>
    </div>
  )
}
