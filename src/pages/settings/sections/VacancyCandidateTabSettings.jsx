import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { getCandidateTabDefaults } from '@/pages/vacancies/lib/candidateTabVisibility'
import SubTabBar from '@/components/drawer/SubTabBar'
import { ColorBadge } from '../components/SettingsControls'

/**
 * Kandidaten zoeken-tab visibility + filter-default editor (Danny 23-07): the
 * vacancy drawer's "Kandidaten zoeken" (candidateSearch) tab is tenant-configurable
 * per vacancy STATUS (which statuses show it) and carries the deployability status
 * + contract-form defaults preselected in the tab's own candidate filter — mirrors
 * the candidate side's `candidate_vacancy_tab` (CandidateVacancyTabSettings, the
 * reference implementation). Stored tenant-wide in the `/settings` blob under
 * `vacancy_candidate_tab` ({ vacancy_statuses, candidate_statuses, contract_forms }:
 * string[] each); all three arrays are always persisted together so a later lookup
 * addition never silently flips behaviour. The drawer reads the same key via
 * `isCandidateTabVisible` / `getCandidateTabDefaults` (candidateTabVisibility.ts).
 *
 * Presented as THREE SUB-TABS (mirrors CandidateVacancyTabSettings' four), one
 * checkbox block per tab — reusing the shared `SubTabBar`, FLAT rows (no bordered
 * card behind sub-tabs, Danny 23-07).
 */
const KEY = 'vacancy_candidate_tab'

// Flat rows under the sub-tab bar — never a bordered card behind sub-tabs
// (Danny 23-07: "we hebben geen grid achter sub-tabjes").
const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }

// One checkbox-list block, shared by all three sub-tabs — the vacancy-status/
// deployability-status/contract-form editors are visually identical, only the
// source list + toggle handler differ.
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

// Wraps the editor in its OWN VacancyLookupsProvider (mirrors CandidateVacancyTabSettings)
// because that context is only mounted page-scoped around VacanciesPage, not here.
export default function VacancyCandidateTabSettings() {
  return (
    <VacancyLookupsProvider>
      <VacancyCandidateTabSettingsInner />
    </VacancyLookupsProvider>
  )
}

function VacancyCandidateTabSettingsInner() {
  const { t } = useTranslation('settings')
  const { statuses: candidateStatuses, candidateTypes } = useLookups()
  const { statuses: vacancyStatuses } = useVacancyLookups()
  const values = useAllSettings()
  const stored = getJsonSetting(values, KEY, null)
  // Absent setting → show the real seed-based effective behaviour, never a blank form.
  const defaults = getCandidateTabDefaults(vacancyStatuses, candidateStatuses, candidateTypes)
  const cfg = {
    vacancy_statuses: stored?.vacancy_statuses ?? defaults.vacancy_statuses,
    candidate_statuses: stored?.candidate_statuses ?? defaults.candidate_statuses,
    contract_forms: stored?.contract_forms ?? defaults.contract_forms,
  }

  // Toggle one value in one of the three arrays; always persists the FULL current
  // config (all three keys explicit), never a partial write — immediate-save, no
  // separate save button (mirrors CandidateVacancyTabSettings).
  const persist = (patch) => saveSettingsKeys({ [KEY]: { ...cfg, ...patch } }).catch(() => {})
  const toggleIn = (key) => (value) =>
    persist({ [key]: cfg[key].includes(value) ? cfg[key].filter(v => v !== value) : [...cfg[key], value] })

  // Three sub-tabs — one per checkbox block, reusing the shared underline SubTabBar.
  const [activeTab, setActiveTab] = useState('vacancy_statuses')
  const tabs = [
    { id: 'vacancy_statuses', label: t('candidateTab.vacancyStatusesTitle') },
    { id: 'candidate_statuses', label: t('candidateTab.candidateStatusesTitle') },
    { id: 'contract_forms', label: t('candidateTab.contractFormsTitle') },
  ]

  return (
    <div style={{ maxWidth: 720 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('candidateTab.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('candidateTab.subtitle')}</p>

      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 14 }}>
        {activeTab === 'vacancy_statuses' && <LookupCheckboxBlock items={vacancyStatuses} selected={cfg.vacancy_statuses} onToggle={toggleIn('vacancy_statuses')} />}
        {activeTab === 'candidate_statuses' && <LookupCheckboxBlock items={candidateStatuses} selected={cfg.candidate_statuses} onToggle={toggleIn('candidate_statuses')} />}
        {activeTab === 'contract_forms' && <LookupCheckboxBlock items={candidateTypes} selected={cfg.contract_forms} onToggle={toggleIn('contract_forms')} />}
      </div>
    </div>
  )
}
