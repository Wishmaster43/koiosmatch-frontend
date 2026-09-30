/**
 * useVacancyAdvice — the ONE resolver both the vacancies TABLE column and the
 * drawer's Koios block call, so they can never disagree (KOIOS-ADVIES-OVERAL-1,
 * mirrors useCandidateAdvice). Composes the shared rule engine (vacancyAdvice.ts)
 * with the tenant's stale-days threshold — the setting is read HERE so the
 * threshold logic has exactly one home, never re-read per consumer.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings } from '@/lib/settings/useAllSettings'
import { readWindowSetting } from '@/lib/settings/readWindowSetting'
import { deriveVacancyAdvice } from '@/pages/vacancies/shared-core'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Vacancy } from '@/types/vacancy'
// The one advice resolver shared by the table column and the drawer's Koios block
// (see the module doc comment above for why it lives here instead of per-consumer).
export function useVacancyAdvice(): (v: Vacancy) => KoiosAdvice | null {
  const { t } = useTranslation(['vacancies', 'common'])
  // How many days without an application counts as "stale" (mirrors candidates'
  // no_contact_alert_months threshold) — tenant-configurable, sensible default.
  // WINDOW-UNIT-READERS-1: the amount's unit (days/workdays/weeks/months)
  // follows the tenant's `vacancy_advice_stale_days_unit` setting.
  const settings = useAllSettings()
  const { amount: staleDays, unit: staleUnit } = readWindowSetting(settings, 'vacancy_advice_stale_days', 14)

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((v: Vacancy): KoiosAdvice | null => {
    // Honest rule engine: published + zero applications + past the stale
    // threshold fires; everything else stays an em-dash.
    const rule = deriveVacancyAdvice(v, { staleDays, staleUnit })
    if (rule.action === 'none') return null
    return {
      action: rule.action,
      label: t('common:koios.actions.attention', { defaultValue: 'Attention' }),
      reason: t(rule.reasonKey, { ...rule.reasonParams, defaultValue: 'No applications yet, posted {{days}} days ago.' }),
      source: 'rules',
    }
  }, [t, staleDays, staleUnit])
}
