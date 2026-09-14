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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { getVacancyTabDefaults, type VacancyTabConfig } from '@/pages/candidates/shared'
import SubTabBar from '@/components/drawer/SubTabBar'
import LookupChipSelect from '../components/LookupChipSelect'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { makeToggleIn } from '@/lib/selectionSet'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

const KEY = 'candidate_vacancy_tab'

// Wraps the editor in its OWN VacancyLookupsProvider (mirrors VacancySearchTab.tsx)
// because that context is only mounted page-scoped around VacanciesPage, not here.
export default function CandidateVacancyTabSettings() {
  return (
    <VacancyLookupsProvider>
      <CandidateVacancyTabSettingsInner />
    </VacancyLookupsProvider>
  )
}

// The actual editor body; needs its own VacancyLookupsProvider since that context is normally only mounted around VacanciesPage (see wrapper above).
function CandidateVacancyTabSettingsInner() {
  const { t } = useTranslation('settings')
  const { phases, statuses, candidateTypes } = useLookups()
  const { statuses: vacancyStatuses } = useVacancyLookups()
  const values = useAllSettings()
  const stored = getJsonSetting<VacancyTabConfig | null>(values, KEY, null)
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
  const persist = (patch: Partial<typeof cfg>) => saveSettingsKeys({ [KEY]: { ...cfg, ...patch } }).catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  const toggleIn = makeToggleIn(cfg, persist)

  // Four sub-tabs — one per checkbox block, reusing the shared underline SubTabBar.
  // TAB-STRIP-WIDTH-1 (F3, mirrors VacancyCandidateTabSettings): the tab bar used
  // to reuse each block's long descriptive sentence as its label (up to ≈734px nl /
  // ≈827px fr/es summed at 4 tabs — wider than this 720px strip). The bar now gets
  // its own short 2-3 word name (`vacancyTab.tabs.<id>`, new keys); the original
  // long sentence still shows, now as the in-tab heading via LookupChipSelect's
  // `label` prop. Measured (Inter 12px ≈ 6.2px/char + 24px/tab): the four short
  // labels sum to ≤ 412px in every locale, well under 720px.
  const [activeTab, setActiveTab] = useState('phases')
  const tabs = [
    { id: 'phases', label: t('vacancyTab.tabs.phases') },
    { id: 'statuses', label: t('vacancyTab.tabs.statuses') },
    { id: 'types', label: t('vacancyTab.tabs.types') },
    { id: 'vacancy_statuses', label: t('vacancyTab.tabs.vacancy_statuses') },
  ]

  return (
    <div style={{ maxWidth: 720 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('vacancyTab.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('vacancyTab.subtitle')}</p>

      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 14 }}>
        {activeTab === 'phases' && <LookupChipSelect items={phases} selected={cfg.phases} onToggle={(v) => toggleIn('phases')(String(v))} label={t('vacancyTab.phasesTitle')} ariaLabel={t('vacancyTab.phasesTitle')} />}
        {activeTab === 'statuses' && <LookupChipSelect items={statuses} selected={cfg.hidden_statuses} onToggle={(v) => toggleIn('hidden_statuses')(String(v))} label={t('vacancyTab.statusesTitle')} ariaLabel={t('vacancyTab.statusesTitle')} />}
        {activeTab === 'types' && <LookupChipSelect items={candidateTypes} selected={cfg.candidate_types} onToggle={(v) => toggleIn('candidate_types')(String(v))} label={t('vacancyTab.typesTitle')} ariaLabel={t('vacancyTab.typesTitle')} />}
        {activeTab === 'vacancy_statuses' && <LookupChipSelect items={vacancyStatuses} selected={cfg.vacancy_statuses} onToggle={(v) => toggleIn('vacancy_statuses')(String(v))} label={t('vacancyTab.vacancyStatusesTitle')} ariaLabel={t('vacancyTab.vacancyStatusesTitle')} />}
      </div>
    </div>
  )
}
