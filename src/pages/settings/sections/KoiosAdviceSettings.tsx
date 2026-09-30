/**
 * KoiosAdviceSettings — Settings → AI → Koios advice thresholds: the two
 * tenant-configurable day windows behind the "Koios" attention column on the
 * vacancies and matches tables (vacancyAdvice.ts / matchAdvice.ts). Both rule
 * engines already read these keys via getNumberSetting() with the historical
 * hardcoded number as fallback (VacanciesTable.tsx / MatchesTable.tsx) — this
 * screen is the missing write path. Persisted through the generic tenant
 * `/settings` key/value store (SettingController::store accepts any string key
 * up to 10000 chars, no whitelist — verified against koiosmatch-api) via the
 * shared NumberSettingField (STALE-INIT-1): local draft, optimistic save on
 * blur, revert + toast on failure, disabled until the blob has loaded. New
 * registry item, not an existing entity's display schema: both thresholds are
 * cross-entity Koios-rule config, not a per-entity table-chip preference, so
 * they sit with the other AI-flavoured settings (Koios overview / memory /
 * vacancy generation).
 *
 * Third field (SOLLICITATIES-23, 14-08): `application_stage_stale_days` — the
 * threshold behind ApplicationQuery/ApplicationListResource's `too_long_in_stage`
 * flag (verified against koiosmatch-api app/Services/Application/ApplicationQuery.php
 * + ApplicationListResource.php), which already drives a REAL attention KPI/filter
 * on the applications page. This screen was its missing write path — exactly the
 * gap the other two fields already closed for vacancies/matches. No notification or
 * escalation exists on this signal yet (no `application.stage_stale` domain event,
 * no dispatcher, no Notifier::send call site) — only the threshold half is real
 * today; do not read the presence of this field as "notifications are wired".
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import { PageTitle } from '@/components/ui/typography'
import NumberSettingField from '../components/NumberSettingField'
import SettingsLoadBanner from '../components/SettingsLoadBanner'
import CatalogSection from './CatalogSection'
import WindowUnitField from '../components/WindowUnitField'
import StageWindowMapField from '../components/StageWindowMapField'
import { useSettingsCatalog } from '../catalog/useSettingsCatalog'
import {
  VACANCY_ADVICE_STALE_DAYS_KEY, VACANCY_ADVICE_STALE_DAYS_UNIT_KEY, MATCH_ADVICE_RENEW_DAYS_KEY,
  MATCH_ADVICE_RENEW_DAYS_UNIT_KEY,
  APPLICATION_STAGE_STALE_DAYS_KEY, APPLICATION_STAGE_STALE_DAYS_UNIT_KEY, APPLICATION_STAGE_STALE_BY_PHASE_KEY,
} from './koiosAdviceKeys'

// Re-exported for call sites/tests that import the keys from this screen module.
export {
  VACANCY_ADVICE_STALE_DAYS_KEY, VACANCY_ADVICE_STALE_DAYS_UNIT_KEY, MATCH_ADVICE_RENEW_DAYS_KEY,
  MATCH_ADVICE_RENEW_DAYS_UNIT_KEY,
  APPLICATION_STAGE_STALE_DAYS_KEY, APPLICATION_STAGE_STALE_DAYS_UNIT_KEY, APPLICATION_STAGE_STALE_BY_PHASE_KEY,
}
const VACANCY_STALE_DEFAULT = 14
const MATCH_RENEW_DEFAULT = 30
const APPLICATION_STAGE_STALE_DEFAULT = 14
const DAYS_MIN = 1
const DAYS_MAX = 365

/** Koios advice thresholds — vacancy staleness, match renewal, application stage staleness. */
// KOIOS-ADVICE-SUBTABS-1 (Danny 29-09: "sub-tabjes voor alles, zo houden we het
// overzichtelijk"): the screen splits into the advice thresholds and the "Koios
// suggests" switches — one shared SubTabBar, local state like ModulesSettings.
type AdviceSubTab = 'thresholds' | 'suggestions'

export default function KoiosAdviceSettings() {
  const { t } = useTranslation('settings')
  const [subTab, setSubTab] = useState<AdviceSubTab>('thresholds')
  // STAGE-STALE-PER-PHASE-1: the per-phase table renders only once the catalogue
  // lists its own key (feature detection — an older BE has no such row yet, and
  // this screen must render exactly as before then, §3B "no hardcoded lookup").
  const { sections: catalogSections } = useSettingsCatalog()
  const hasStageByPhase = useMemo(
    () => catalogSections.some(section => section.keys.some(row => row.key === APPLICATION_STAGE_STALE_BY_PHASE_KEY)),
    [catalogSections],
  )
  // WINDOW-UNIT-READERS-1: the match-renewal unit picker renders only once the
  // BE catalogue lists this key (an older BE would 422 on the write otherwise).
  const hasMatchUnitRow = useMemo(
    () => catalogSections.some(section => section.keys.some(row => row.key === MATCH_ADVICE_RENEW_DAYS_UNIT_KEY)),
    [catalogSections],
  )
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsLoadBanner />
      <div style={{ marginBottom: 16 }}>
        <PageTitle>{t('koiosAdvice.title')}</PageTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('koiosAdvice.subtitle')}</p>
      </div>
      <div style={{ marginBottom: 20 }}>
        <SubTabBar active={subTab} onChange={(id) => setSubTab(id as AdviceSubTab)} tabs={[
          { id: 'thresholds', label: t('koiosAdvice.tabs.thresholds') },
          { id: 'suggestions', label: t('koiosAdvice.tabs.suggestions') },
        ]} />
      </div>
      {subTab === 'thresholds' && (<>
      {/* How many days without an application before a published vacancy counts as
          "stale" (VacanciesTable.tsx's Koios column). */}
      <NumberSettingField id="vacancy-advice-stale-days" settingsKey={VACANCY_ADVICE_STALE_DAYS_KEY}
        title={t('koiosAdvice.vacancyStaleTitle')} hint={t('koiosAdvice.vacancyStaleHint')}
        label={t('koiosAdvice.vacancyStaleLabel')} saveFailedMessage={t('koiosAdvice.vacancyStaleSaveFailed')}
        defaultValue={VACANCY_STALE_DEFAULT} min={DAYS_MIN} max={DAYS_MAX}
        unit={<WindowUnitField settingsKey={VACANCY_ADVICE_STALE_DAYS_UNIT_KEY}
          ariaLabel={t('settings.windows.vacancy_advice_stale_days_unit.label')}
          saveFailedMessage={t('koiosAdvice.vacancyStaleSaveFailed')} />} />
      {/* How many days before (or past) a match's end date counts as "approaching"
          (MatchesTable.tsx's Koios column, "Renew?"). WINDOW-UNIT-READERS-1: the
          FE reads match_advice_renew_days through the same readWindowSetting
          helper as the other two windows; the unit picker itself renders only
          once the BE catalogue lists the row (feature detection, hasMatchUnitRow). */}
      <NumberSettingField id="match-advice-renew-days" settingsKey={MATCH_ADVICE_RENEW_DAYS_KEY}
        title={t('koiosAdvice.matchRenewTitle')} hint={t('koiosAdvice.matchRenewHint')}
        label={t('koiosAdvice.matchRenewLabel')} saveFailedMessage={t('koiosAdvice.matchRenewSaveFailed')}
        defaultValue={MATCH_RENEW_DEFAULT} min={DAYS_MIN} max={DAYS_MAX}
        unit={hasMatchUnitRow ? <WindowUnitField settingsKey={MATCH_ADVICE_RENEW_DAYS_UNIT_KEY}
          ariaLabel={t('settings.windows.match_advice_renew_days_unit.label')}
          saveFailedMessage={t('koiosAdvice.matchRenewSaveFailed')} /> : undefined} />
      {/* How many days an application can sit in its current funnel stage before
          Koios flags it "too long in stage" (ApplicationsTable/ApplicationsPage
          attention KPI). */}
      <NumberSettingField id="application-stage-stale-days" settingsKey={APPLICATION_STAGE_STALE_DAYS_KEY}
        title={t('koiosAdvice.applicationStaleTitle')} hint={t('koiosAdvice.applicationStaleHint')}
        label={t('koiosAdvice.applicationStaleLabel')} saveFailedMessage={t('koiosAdvice.applicationStaleSaveFailed')}
        defaultValue={APPLICATION_STAGE_STALE_DEFAULT} min={DAYS_MIN} max={DAYS_MAX}
        bordered={hasStageByPhase}
        unit={<WindowUnitField settingsKey={APPLICATION_STAGE_STALE_DAYS_UNIT_KEY}
          ariaLabel={t('settings.windows.application_stage_stale_days_unit.label')}
          saveFailedMessage={t('koiosAdvice.applicationStaleSaveFailed')} />} />
      {/* STAGE-STALE-PER-PHASE-1 (Danny 29-09: "Intake 3 dagen, voorgesteld 2
          werkdagen"): per-stage overrides of the window above — only once the
          catalogue carries the key (feature detection, older BE renders nothing here). */}
      {hasStageByPhase && <StageWindowMapField />}
      </>)}
      {/* KOIOS-SUGGEST-COMPACT-2 (Danny 28-09: "waar is instelbaar welke suggesties er
          komen en wanneer iets te laat is?"): the "Koios suggests" block's own switches
          and day windows live in the settings catalogue (section windows, group
          koios_suggest — per kind on/off, the overdue and vacancy windows with their
          unit, the row maximum); its own sub-tab next to the advice thresholds. */}
      {subTab === 'suggestions' && <CatalogSection section="windows" group="koios_suggest" headedBy="group" embedded />}
    </div>
  )
}
