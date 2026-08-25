/**
 * useVacancyAdvice — the ONE resolver both the vacancies TABLE column and the
 * drawer's Koios block call, so they can never disagree (KOIOS-ADVIES-OVERAL-1,
 * mirrors useCandidateAdvice). Composes the shared rule engine (vacancyAdvice.ts)
 * with the tenant's stale-days threshold — the setting is read HERE so the
 * threshold logic has exactly one home, never re-read per consumer.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getNumberSetting } from '@/lib/settings/useAllSettings'
import { deriveVacancyAdvice } from '@/pages/vacancies/shared'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Vacancy } from '@/types/vacancy'
export function useVacancyAdvice(): (v: Vacancy) => KoiosAdvice | null {
  const { t } = useTranslation(['vacancies', 'common'])
  // How many days without an application counts as "stale" (mirrors candidates'
  // no_contact_alert_months threshold) — tenant-configurable, sensible default.
  const settings = useAllSettings()
  const staleDays = getNumberSetting(settings, 'vacancy_advice_stale_days', 14)

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((v: Vacancy): KoiosAdvice | null => {
    // Honest rule engine: published + zero applications + past the stale
    // threshold fires; everything else stays an em-dash.
    const rule = deriveVacancyAdvice(v, { staleDays })
    if (rule.action === 'none') return null
    return {
      action: rule.action,
      label: t('common:koios.actions.attention', { defaultValue: 'Attention' }),
      reason: t(rule.reasonKey, { ...rule.reasonParams, defaultValue: 'No applications yet, posted {{days}} days ago.' }),
      source: 'rules',
    }
  }, [t, staleDays])
}
