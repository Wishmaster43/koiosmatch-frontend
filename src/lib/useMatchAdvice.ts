/**
 * useMatchAdvice — the ONE resolver both the matches TABLE column and the
 * drawer's Koios block call, so they can never disagree (KOIOS-ADVIES-OVERAL-1,
 * mirrors useCandidateAdvice). Composes the shared rule engine (matchAdvice.ts)
 * with the tenant's renew-window threshold and the /match-statuses is_closed
 * flag — both resolved HERE so the logic has exactly one home.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getNumberSetting } from '@/lib/settings/useAllSettings'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { deriveMatchAdvice } from '@/pages/matches/shared'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { MatchRow } from '@/types/match'
// Resolves one match's Koios advice by composing the shared rule engine with tenant settings and lifecycle status — the single source both the table and drawer read.
export function useMatchAdvice(): (m: MatchRow) => KoiosAdvice | null {
  const { t } = useTranslation('matches')
  // Match lifecycle lookup (R-1b) — a closed match has nothing left to renew.
  const { metaOf: statusMeta } = useMatchStatuses()
  // How many days before (or past) the end date counts as "approaching" — tenant-
  // configurable, mirrors vacancies' staleDays.
  const settings = useAllSettings()
  const renewWithinDays = getNumberSetting(settings, 'match_advice_renew_days', 30)

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((m: MatchRow): KoiosAdvice | null => {
    // Honest rule engine: an open match whose end date is approaching or passed
    // fires; closed, open-ended or comfortable-runway rows stay an em-dash.
    const rule = deriveMatchAdvice(m, { isClosed: Boolean(statusMeta(m.status)?.is_closed), renewWithinDays })
    if (rule.action === 'none') return null
    return {
      action: rule.action,
      label: t('common:koios.actions.renew'),
      reason: t(rule.reasonKey, { ...rule.reasonParams, defaultValue: 'The contract end date is approaching.' }),
      source: 'rules',
    }
  }, [t, statusMeta, renewWithinDays])
}
