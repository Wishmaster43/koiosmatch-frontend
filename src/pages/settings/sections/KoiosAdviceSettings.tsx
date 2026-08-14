/**
 * KoiosAdviceSettings — Settings → AI → Koios advice thresholds: the two
 * tenant-configurable day windows behind the "Koios" attention column on the
 * vacancies and matches tables (vacancyAdvice.ts / matchAdvice.ts). Both rule
 * engines already read these keys via getNumberSetting() with the historical
 * hardcoded number as fallback (VacanciesTable.tsx / MatchesTable.tsx) — this
 * screen is the missing write path. Persisted through the generic tenant
 * `/settings` key/value store (SettingController::store accepts any string key
 * up to 10000 chars, no whitelist — verified against koiosmatch-api): local
 * state, optimistic save on blur, revert + toast on failure — mirrors the
 * NoContactDaysField (CandidateCommSettings.jsx) / ConversationMemoryField
 * (WhatsAppLog.tsx) house pattern exactly. New registry item, not an existing
 * entity's display schema: both thresholds are cross-entity Koios-rule config,
 * not a per-entity table-chip preference, so they sit with the other
 * AI-flavoured settings (Koios overview / memory / vacancy generation).
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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache, getNumberSetting } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'

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

// How many days without an application before a published vacancy counts as
// "stale" (VacanciesTable.tsx's Koios column). Commits on blur, optimistic
// with revert-on-failure.
function VacancyStaleDaysField() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const saved = getNumberSetting(settings, VACANCY_ADVICE_STALE_DAYS_KEY, VACANCY_STALE_DEFAULT)
  const [value, setValue] = useState(saved)

  // Persist one clamped value — optimistic, revert + toast on failure (house pattern).
  const commit = async (raw: number) => {
    const clamped = Math.min(DAYS_MAX, Math.max(DAYS_MIN, Number(raw) || VACANCY_STALE_DEFAULT))
    if (clamped === saved) { setValue(clamped); return }
    setValue(clamped)
    try {
      await saveSettingsKeys({ [VACANCY_ADVICE_STALE_DAYS_KEY]: clamped })
      invalidateAllSettingsCache()
    } catch {
      setValue(saved)
      notifyError(t('koiosAdvice.vacancyStaleSaveFailed'))
    }
  }

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('koiosAdvice.vacancyStaleTitle')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{t('koiosAdvice.vacancyStaleHint')}</div>
      <label htmlFor="vacancy-advice-stale-days" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
        {t('koiosAdvice.vacancyStaleLabel')}
      </label>
      <input id="vacancy-advice-stale-days" type="number" min={DAYS_MIN} max={DAYS_MAX}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        onBlur={e => commit(Number(e.target.value))}
        style={{ width: 100, height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }} />
    </div>
  )
}

// How many days before (or past) a match's end date counts as "approaching"
// (MatchesTable.tsx's Koios column, "Renew?"). Same commit-on-blur pattern.
function MatchRenewDaysField() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const saved = getNumberSetting(settings, MATCH_ADVICE_RENEW_DAYS_KEY, MATCH_RENEW_DEFAULT)
  const [value, setValue] = useState(saved)

  // Persist one clamped value — optimistic, revert + toast on failure (house pattern).
  const commit = async (raw: number) => {
    const clamped = Math.min(DAYS_MAX, Math.max(DAYS_MIN, Number(raw) || MATCH_RENEW_DEFAULT))
    if (clamped === saved) { setValue(clamped); return }
    setValue(clamped)
    try {
      await saveSettingsKeys({ [MATCH_ADVICE_RENEW_DAYS_KEY]: clamped })
      invalidateAllSettingsCache()
    } catch {
      setValue(saved)
      notifyError(t('koiosAdvice.matchRenewSaveFailed'))
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('koiosAdvice.matchRenewTitle')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{t('koiosAdvice.matchRenewHint')}</div>
      <label htmlFor="match-advice-renew-days" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
        {t('koiosAdvice.matchRenewLabel')}
      </label>
      <input id="match-advice-renew-days" type="number" min={DAYS_MIN} max={DAYS_MAX}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        onBlur={e => commit(Number(e.target.value))}
        style={{ width: 100, height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }} />
    </div>
  )
}

// How many days an application can sit in its current funnel stage before
// Koios flags it "too long in stage" (ApplicationsTable/ApplicationsPage
// attention KPI). Same commit-on-blur pattern; no trailing border since this
// is currently the last field in the list.
function ApplicationStageStaleDaysField() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const saved = getNumberSetting(settings, APPLICATION_STAGE_STALE_DAYS_KEY, APPLICATION_STAGE_STALE_DEFAULT)
  const [value, setValue] = useState(saved)

  // Persist one clamped value — optimistic, revert + toast on failure (house pattern).
  const commit = async (raw: number) => {
    const clamped = Math.min(DAYS_MAX, Math.max(DAYS_MIN, Number(raw) || APPLICATION_STAGE_STALE_DEFAULT))
    if (clamped === saved) { setValue(clamped); return }
    setValue(clamped)
    try {
      await saveSettingsKeys({ [APPLICATION_STAGE_STALE_DAYS_KEY]: clamped })
      invalidateAllSettingsCache()
    } catch {
      setValue(saved)
      notifyError(t('koiosAdvice.applicationStaleSaveFailed'))
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('koiosAdvice.applicationStaleTitle')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{t('koiosAdvice.applicationStaleHint')}</div>
      <label htmlFor="application-stage-stale-days" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
        {t('koiosAdvice.applicationStaleLabel')}
      </label>
      <input id="application-stage-stale-days" type="number" min={DAYS_MIN} max={DAYS_MAX}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        onBlur={e => commit(Number(e.target.value))}
        style={{ width: 100, height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }} />
    </div>
  )
}

/** Koios advice thresholds — vacancy staleness, match renewal, application stage staleness. */
export default function KoiosAdviceSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('koiosAdvice.title')}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('koiosAdvice.subtitle')}</p>
      </div>
      <VacancyStaleDaysField />
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <MatchRenewDaysField />
      </div>
      <ApplicationStageStaleDaysField />
    </div>
  )
}
