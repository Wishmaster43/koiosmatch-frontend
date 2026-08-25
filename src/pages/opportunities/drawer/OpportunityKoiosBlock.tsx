/** Koios advisory for the opportunity drawer — thin wrapper mirroring the
 *  candidate/match drawer's own Koios block (§3A). ALWAYS renders (Danny:
 *  the block must never disappear — mirrors matches/candidates): the
 *  table-identical advice row first (KOIOS-ADVIES-OVERAL-1, resolved via the
 *  SAME useOpportunityAdvice hook the table's Koios column uses — [] when
 *  there is none, never an empty row), then the honest DERIVED default rows
 *  (buildOpportunityAdviceInsights: deal-magnitude health + close-date
 *  window) so the block always shows something, even with no real advice. */
import { useTranslation } from 'react-i18next'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useOpportunityAdvice } from '@/lib/useOpportunityAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import { buildOpportunityAdviceInsights } from './opportunityAiInsights'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

export default function OpportunityKoiosBlock({ opportunity, stages = [] }: {
  opportunity: Opportunity
  // The tenant's stage lookup (won/lost flags) — the same list the page hands the table.
  stages?: LookupOption[]
}) {
  const { t } = useTranslation('opportunities')
  const resolveAdvice = useOpportunityAdvice(stages)
  return (
    <KoiosAdviceBlock namespace="opportunities"
      insights={[...adviceInsightRows(resolveAdvice(opportunity)), ...buildOpportunityAdviceInsights(opportunity, stages, t)]} />
  )
}
