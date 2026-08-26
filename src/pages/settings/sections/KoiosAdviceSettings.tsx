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
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/typography'
import NumberSettingField from '../components/NumberSettingField'

// Tenant-setting keys — the generic /settings key/value store. Defaults mirror
// the fallback numbers vacancyAdvice.ts/matchAdvice.ts's callers already use.
export const VACANCY_ADVICE_STALE_DAYS_KEY = 'vacancy_advice_stale_days'
export const MATCH_ADVICE_RENEW_DAYS_KEY = 'match_advice_renew_days'
export const APPLICATION_STAGE_STALE_DAYS_KEY = 'application_stage_stale_days'
const VACANCY_STALE_DEFAULT = 14
const MATCH_RENEW_DEFAULT = 30
const APPLICATION_STAGE_STALE_DEFAULT = 14
const DAYS_MIN = 1
const DAYS_MAX = 365

/** Koios advice thresholds — vacancy staleness, match renewal, application stage staleness. */
export default function KoiosAdviceSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <PageTitle>{t('koiosAdvice.title')}</PageTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('koiosAdvice.subtitle')}</p>
      </div>
      {/* How many days without an application before a published vacancy counts as
          "stale" (VacanciesTable.tsx's Koios column). */}
      <NumberSettingField id="vacancy-advice-stale-days" settingsKey={VACANCY_ADVICE_STALE_DAYS_KEY}
        title={t('koiosAdvice.vacancyStaleTitle')} hint={t('koiosAdvice.vacancyStaleHint')}
        label={t('koiosAdvice.vacancyStaleLabel')} saveFailedMessage={t('koiosAdvice.vacancyStaleSaveFailed')}
        defaultValue={VACANCY_STALE_DEFAULT} min={DAYS_MIN} max={DAYS_MAX} />
      {/* How many days before (or past) a match's end date counts as "approaching"
          (MatchesTable.tsx's Koios column, "Renew?"). */}
      <NumberSettingField id="match-advice-renew-days" settingsKey={MATCH_ADVICE_RENEW_DAYS_KEY}
        title={t('koiosAdvice.matchRenewTitle')} hint={t('koiosAdvice.matchRenewHint')}
        label={t('koiosAdvice.matchRenewLabel')} saveFailedMessage={t('koiosAdvice.matchRenewSaveFailed')}
        defaultValue={MATCH_RENEW_DEFAULT} min={DAYS_MIN} max={DAYS_MAX} />
      {/* How many days an application can sit in its current funnel stage before
          Koios flags it "too long in stage" (ApplicationsTable/ApplicationsPage
          attention KPI). No trailing border: currently the last field in the list. */}
      <NumberSettingField id="application-stage-stale-days" settingsKey={APPLICATION_STAGE_STALE_DAYS_KEY}
        title={t('koiosAdvice.applicationStaleTitle')} hint={t('koiosAdvice.applicationStaleHint')}
        label={t('koiosAdvice.applicationStaleLabel')} saveFailedMessage={t('koiosAdvice.applicationStaleSaveFailed')}
        defaultValue={APPLICATION_STAGE_STALE_DEFAULT} min={DAYS_MIN} max={DAYS_MAX} bordered={false} />
    </div>
  )
}
