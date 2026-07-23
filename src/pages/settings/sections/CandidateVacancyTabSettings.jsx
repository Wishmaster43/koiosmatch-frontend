import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { getVacancyTabDefaults } from '@/pages/candidates/lib/vacancyTabVisibility'
import SubTabBar from '@/components/drawer/SubTabBar'
import { ColorBadge } from '../components/SettingsControls'

/**
 * Vacatures-tab visibility + filter-default editor (Danny 23-07): the candidate
 * drawer's "Vacatures" (vacancySearch) tab is tenant-configurable per candidate
 * PHASE (which phases show it), per deployability STATUS (which statuses hide it),
 * per contract form/Contractvorm (which types show it), and the vacancy STATUSES
 * preselected in the tab's own filter — e.g. off by default for a Lead or an
 * Unavailable candidate, but always tenant-configurable. Stored tenant-wide in the
 * `/settings` blob under `candidate_vacancy_tab`
 * ({ phases, hidden_statuses, candidate_types, vacancy_statuses }: string[] each);
 * all four arrays are always persisted together so a later lookup addition never
 * silently flips behaviour. The drawer/hook read the same key via
 * `isVacancyTabVisible` / `getVacancyTabDefaults` (vacancyTabVisibility.ts).
 *
 * Presented as FOUR SUB-TABS (Danny 23-07 live feedback), one checkbox block per
 * tab — reusing the shared `SubTabBar` (the same bar ActionRulesSettings uses for
 * its in-file domain tabs), not a new tab-bar implementation.
 */
const KEY = 'candidate_vacancy_tab'

// Flat rows under the sub-tab bar — never a bordered card behind sub-tabs
// (Danny 23-07: "we hebben geen grid achter sub-tabjes").
const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }

// One checkbox-list block, shared by all four sub-tabs — the phase/status/
// contract-form/vacancy-status editors are visually identical, only the source
// list + toggle handler differ.
function LookupCheckboxBlock({ items, selected, onToggle }) {
  return (
    <div>
      {items.map(it => (
        <label key={it.value} style={row}>
          <input type="checkbox" checked={selected.includes(it.value)} onChange={() => onToggle(it.value)}
            style={{ cursor: 'pointer', width: 16, height: 16 }} />
          {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
          <ColorBadge label={it.label} color={it.color ?? '#6B7280'} />
        </label>
      ))}
    </div>
  )
}

// Wraps the editor in its OWN VacancyLookupsProvider (mirrors VacancySearchTab.tsx)
// because that context is only mounted page-scoped around VacanciesPage, not here.
export default function CandidateVacancyTabSettings() {
  return (
    <VacancyLookupsProvider>
      <CandidateVacancyTabSettingsInner />
    </VacancyLookupsProvider>
  )
}

function CandidateVacancyTabSettingsInner() {
  const { t } = useTranslation('settings')
  const { phases, statuses, candidateTypes } = useLookups()
  const { statuses: vacancyStatuses } = useVacancyLookups()
  const values = useAllSettings()
  const stored = getJsonSetting(values, KEY, null)
  // Absent setting → show the real seed-based effective behaviour, never a blank form.
  const defaults = getVacancyTabDefaults(phases, statuses, candidateTypes, vacancyStatuses)
  const cfg = {
    phases: stored?.phases ?? defaults.phases,
    hidden_statuses: stored?.hidden_statuses ?? defaults.hidden_statuses,
    candidate_types: stored?.candidate_types ?? defaults.candidate_types,
    vacancy_statuses: stored?.vacancy_statuses ?? defaults.vacancy_statuses,
  }

  // Toggle one value in one of the four arrays; always persists the FULL current
  // config (all four keys explicit), never a partial write — immediate-save, no
  // separate save button (Danny confirmed).
  const persist = (patch) => saveSettingsKeys({ [KEY]: { ...cfg, ...patch } }).catch(() => {})
  const toggleIn = (key) => (value) =>
    persist({ [key]: cfg[key].includes(value) ? cfg[key].filter(v => v !== value) : [...cfg[key], value] })

  // Four sub-tabs — one per checkbox block, reusing the shared underline SubTabBar.
  const [activeTab, setActiveTab] = useState('phases')
  const tabs = [
    { id: 'phases', label: t('vacancyTab.phasesTitle') },
    { id: 'statuses', label: t('vacancyTab.statusesTitle') },
    { id: 'types', label: t('vacancyTab.typesTitle') },
    { id: 'vacancy_statuses', label: t('vacancyTab.vacancyStatusesTitle') },
  ]

  return (
    <div style={{ maxWidth: 720 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('vacancyTab.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('vacancyTab.subtitle')}</p>

      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 14 }}>
        {activeTab === 'phases' && <LookupCheckboxBlock items={phases} selected={cfg.phases} onToggle={toggleIn('phases')} />}
        {activeTab === 'statuses' && <LookupCheckboxBlock items={statuses} selected={cfg.hidden_statuses} onToggle={toggleIn('hidden_statuses')} />}
        {activeTab === 'types' && <LookupCheckboxBlock items={candidateTypes} selected={cfg.candidate_types} onToggle={toggleIn('candidate_types')} />}
        {activeTab === 'vacancy_statuses' && <LookupCheckboxBlock items={vacancyStatuses} selected={cfg.vacancy_statuses} onToggle={toggleIn('vacancy_statuses')} />}
      </div>
    </div>
  )
}
