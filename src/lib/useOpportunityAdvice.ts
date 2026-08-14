import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { deriveOpportunityAdvice } from '@/pages/opportunities/data/opportunityAdvice'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

/**
 * useOpportunityAdvice — the ONE resolver both the opportunities TABLE column
 * and the drawer's Koios block call, so they can never disagree
 * (KOIOS-ADVIES-OVERAL-1, mirrors useCandidateAdvice). Composes the shared
 * rule engine (opportunityAdvice.ts) — the same overdue check the
 * expectedClose cell uses for its red/bold styling (§11: one computation).
 * `stages` carries the tenant's won/lost flags: a closed deal is never overdue.
 */
export function useOpportunityAdvice(stages: LookupOption[] = []): (r: Opportunity) => KoiosAdvice | null {
  const { t } = useTranslation(['opportunities', 'common'])

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((r: Opportunity): KoiosAdvice | null => {
    // Honest rule engine: an overdue, still-open deal needs a follow-up.
    const rule = deriveOpportunityAdvice(r, stages)
    if (rule.action === 'none') return null
    return {
      action: rule.action,
      label: t('common:koios.actions.follow_up'),
      reason: t(rule.reasonKey, { defaultValue: 'The expected close date has passed.' }),
      source: 'rules',
    }
  }, [t, stages])
}
