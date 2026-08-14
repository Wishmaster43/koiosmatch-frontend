import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useOpportunityAdvice } from '@/lib/useOpportunityAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

/** Koios advisory for the opportunity drawer — thin wrapper mirroring the
 *  candidate drawer's KoiosAiBlock (§3A). Resolves the SAME advice the table's
 *  Koios column shows (useOpportunityAdvice, KOIOS-ADVIES-OVERAL-1) and renders
 *  nothing at all when there is none (no empty shell). Heading copy comes from
 *  the shared common:ai.* block (all five locales). */
export default function OpportunityKoiosBlock({ opportunity, stages = [] }: {
  opportunity: Opportunity
  // The tenant's stage lookup (won/lost flags) — the same list the page hands the table.
  stages?: LookupOption[]
}) {
  const resolveAdvice = useOpportunityAdvice(stages)
  const insights = adviceInsightRows(resolveAdvice(opportunity))
  if (insights.length === 0) return null
  return <KoiosAdviceBlock namespace="common" insights={insights} />
}
