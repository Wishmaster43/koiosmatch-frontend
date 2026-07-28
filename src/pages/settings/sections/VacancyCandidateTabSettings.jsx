import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { getCandidateTabDefaults } from '@/pages/vacancies/lib/candidateTabVisibility'
import SubTabBar from '@/components/drawer/SubTabBar'
import { ColorBadge } from '../components/SettingsControls'
import { Toggle } from '../components/SettingsKit'

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
 *
 * LEADS-CRITERIA-1 (Danny 25/26-07): the SAME `vacancy_candidate_tab` blob also
 * drives the backend `MatchCriteriaResolver` service that computes the vacancy
 * "leads" counter — POSSIBLE candidates matching a vacancy (available + fits the
 * match criteria, or placed-but-expiring-soon). Every field below already has a
 * live backend default and takes effect immediately once persisted — this is not
 * a placeholder block. `function_match: 'category'` is a known backend caveat
 * (vacancies have no category column yet) and must say so honestly, never present
 * itself as doing more than 'exact' does today.
 */
const KEY = 'vacancy_candidate_tab'

// Flat rows under the sub-tab bar — never a bordered card behind sub-tabs
// (Danny 23-07: "we hebben geen grid achter sub-tabjes").
const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }

// Function-match strictness options for the leads-criteria block — 'category' is
// flagged with an honest note because vacancies have no category column yet (the
// backend MatchCriteriaResolver treats it exactly like 'exact' until that lands).
const FUNCTION_MATCH_OPTIONS = [
  { value: 'exact', labelKey: 'functionMatchExact', descKey: 'functionMatchExactDesc' },
  { value: 'category', labelKey: 'functionMatchCategory', descKey: 'functionMatchCategoryDesc' },
  { value: 'all', labelKey: 'functionMatchAll', descKey: 'functionMatchAllDesc' },
]

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

// One label+hint toggle row, reused for every boolean leads-criteria toggle
// (apply_radius / exclude_already_applied / include_expiring_placements) so the
// layout stays identical across all three. The shared house Toggle (Danny 28-07:
// "GEEN VINKJES MAAR TOGGLES!!!") replaces the raw checkbox; `ariaLabel` keeps the
// switch's accessible name short (just the label, not label+hint concatenated).
function CheckboxRow({ checked, onChange, label, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <Toggle checked={checked} onChange={onChange} ariaLabel={label} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{hint}</span>
      </span>
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
  // RADIUS-SETTING-1 (Danny 25-07) + LEADS-CRITERIA-1 (Danny 25/26-07): every field
  // below mirrors the backend MatchCriteriaResolver's own default 1:1, so an absent
  // setting always renders the real effective backend behaviour, never a blank form.
  const cfg = {
    vacancy_statuses: stored?.vacancy_statuses ?? defaults.vacancy_statuses,
    candidate_statuses: stored?.candidate_statuses ?? defaults.candidate_statuses,
    contract_forms: stored?.contract_forms ?? defaults.contract_forms,
    default_radius_km: stored?.default_radius_km ?? 30,
    countable_vacancy_statuses: stored?.countable_vacancy_statuses ?? [],
    apply_radius: stored?.apply_radius ?? true,
    function_match: stored?.function_match ?? 'exact',
    exclude_already_applied: stored?.exclude_already_applied ?? true,
    include_expiring_placements: stored?.include_expiring_placements ?? true,
    expiring_within_days: stored?.expiring_within_days ?? 30,
  }

  // Toggle one value in one of the array-valued keys; always persists the FULL
  // current config, never a partial write — immediate-save, no separate save
  // button (mirrors CandidateVacancyTabSettings).
  const persist = (patch) => saveSettingsKeys({ [KEY]: { ...cfg, ...patch } }).catch(() => {})
  const toggleIn = (key) => (value) =>
    persist({ [key]: cfg[key].includes(value) ? cfg[key].filter(v => v !== value) : [...cfg[key], value] })
  // Flip one boolean leads-criteria key (apply_radius / exclude_already_applied /
  // include_expiring_placements) — same immediate full-object persist.
  const toggleBool = (key) => () => persist({ [key]: !cfg[key] })
  // Clamp to the 1..500 range before persisting so a stray out-of-bounds value
  // (typed or pasted past the input's own min/max, which browsers don't hard-enforce)
  // never gets written.
  const setRadius = (raw) => {
    const n = Math.min(500, Math.max(1, Number(raw) || 1))
    persist({ default_radius_km: n })
  }
  // Same clamp discipline for the expiring-placement lookahead window (1..365 days).
  const setExpiringDays = (raw) => {
    const n = Math.min(365, Math.max(1, Number(raw) || 1))
    persist({ expiring_within_days: n })
  }

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

      {/* LEADS-CRITERIA-1: every control below is read by the SAME backend
          MatchCriteriaResolver that computes the vacancy leads counter AND this
          tab's own candidate search — a change here changes both immediately. */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('candidateTab.leadsCriteria.title')}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 16 }}>{t('candidateTab.leadsCriteria.subtitle')}</p>

        {/* (a) countable_vacancy_statuses — which vacancy statuses count toward the
            leads counter; reuses the same vacancy-status list + checkbox affordance
            as the sub-tab above. Empty selection = every status counts. */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
            {t('candidateTab.leadsCriteria.countableStatusesTitle')}
          </label>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('candidateTab.leadsCriteria.countableStatusesHint')}</p>
          <LookupCheckboxBlock items={vacancyStatuses} selected={cfg.countable_vacancy_statuses} onToggle={toggleIn('countable_vacancy_statuses')} />
        </div>

        {/* (b)+(c) apply_radius gates default_radius_km (RADIUS-SETTING-1's input,
            moved here since it only matters for the leads counter's distance
            filter): OFF means distance is ignored entirely, so the radius input
            renders disabled (never hidden) to keep that relationship visible. */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
            {t('candidateTab.leadsCriteria.radiusTitle')}
          </label>
          <CheckboxRow checked={cfg.apply_radius} onChange={toggleBool('apply_radius')}
            label={t('candidateTab.leadsCriteria.applyRadiusLabel')} hint={t('candidateTab.leadsCriteria.applyRadiusHint')} />
          <div style={{ marginTop: 10, marginLeft: 26 }}>
            <label htmlFor="vacancy-candidate-tab-radius" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
              {t('candidateTab.defaultRadiusLabel')}
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('candidateTab.defaultRadiusHint')}</p>
            <input id="vacancy-candidate-tab-radius" type="number" min={1} max={500} value={cfg.default_radius_km}
              disabled={!cfg.apply_radius}
              onChange={e => setRadius(e.target.value)}
              style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: cfg.apply_radius ? 'var(--surface)' : 'var(--bg)', color: 'var(--text)', fontSize: 12,
                opacity: cfg.apply_radius ? 1 : 0.55, cursor: cfg.apply_radius ? 'text' : 'not-allowed' }} />
          </div>
        </div>

        {/* (d) function_match — how strictly the candidate's function must match
            the vacancy's; 'category' carries an honest muted note since it behaves
            exactly like 'exact' today (no vacancy category column yet). */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
            {t('candidateTab.leadsCriteria.functionMatchTitle')}
          </label>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('candidateTab.leadsCriteria.functionMatchHint')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FUNCTION_MATCH_OPTIONS.map(opt => {
              const active = cfg.function_match === opt.value
              return (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                  borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                  background: active ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'var(--bg)' }}>
                  <input type="radio" name="function_match" value={opt.value} checked={active}
                    aria-label={t(`candidateTab.leadsCriteria.${opt.labelKey}`)}
                    onChange={() => persist({ function_match: opt.value })}
                    style={{ marginTop: 2, accentColor: 'var(--color-primary)' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: active ? 600 : 500, color: 'var(--text)' }}>
                      {t(`candidateTab.leadsCriteria.${opt.labelKey}`)}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                      {t(`candidateTab.leadsCriteria.${opt.descKey}`)}
                    </span>
                    {/* Honest backend caveat — never present 'category' as doing more than it does today. */}
                    {opt.value === 'category' && (
                      <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 2 }}>
                        {t('candidateTab.leadsCriteria.functionMatchCategoryNote')}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* (e) exclude_already_applied — a candidate with a live application on THIS
            vacancy no longer counts as a lead (already in the funnel, not a prospect). */}
        <div style={{ marginBottom: 18 }}>
          <CheckboxRow checked={cfg.exclude_already_applied} onChange={toggleBool('exclude_already_applied')}
            label={t('candidateTab.leadsCriteria.excludeAlreadyAppliedLabel')} hint={t('candidateTab.leadsCriteria.excludeAlreadyAppliedHint')} />
        </div>

        {/* (f) include_expiring_placements — a candidate placed right now still
            counts as a lead while their placement/match ends within
            expiring_within_days (Danny: "kandidaten die nu geplaatst zijn maar
            wiens match afloopt"). */}
        <div>
          <CheckboxRow checked={cfg.include_expiring_placements} onChange={toggleBool('include_expiring_placements')}
            label={t('candidateTab.leadsCriteria.includeExpiringPlacementsLabel')} hint={t('candidateTab.leadsCriteria.includeExpiringPlacementsHint')} />
          <div style={{ marginTop: 10, marginLeft: 26 }}>
            <label htmlFor="vacancy-candidate-tab-expiring-days" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
              {t('candidateTab.leadsCriteria.expiringWithinDaysLabel')}
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('candidateTab.leadsCriteria.expiringWithinDaysHint')}</p>
            <input id="vacancy-candidate-tab-expiring-days" type="number" min={1} max={365} value={cfg.expiring_within_days}
              disabled={!cfg.include_expiring_placements}
              onChange={e => setExpiringDays(e.target.value)}
              style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: cfg.include_expiring_placements ? 'var(--surface)' : 'var(--bg)', color: 'var(--text)', fontSize: 12,
                opacity: cfg.include_expiring_placements ? 1 : 0.55, cursor: cfg.include_expiring_placements ? 'text' : 'not-allowed' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
