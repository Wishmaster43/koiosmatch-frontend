/**
 * opportunityAdvice — the terminal-stage/overdue check shared by the
 * expectedClose cell's red-bold styling AND the "Koios" column's rule engine
 * (was duplicated the moment the koios column needed the same check — §11:
 * a new consumer adopts the existing computation, never a second copy).
 */
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

// A stage flagged isWon/isLost is terminal — a closed deal's expected-close
// date is never "overdue" (§4: red/bold is a live-state signal, not permanent).
export function isTerminalStage(r: Opportunity, stages: LookupOption[]): boolean {
  return stages.some(s => (s.isWon || s.isLost) && String(s.value) === String(r.stageValue))
}

// The expected-close date has passed and the deal is still open.
export function isExpectedCloseOverdue(r: Opportunity, stages: LookupOption[], now: Date = new Date()): boolean {
  if (!r.expectedCloseAt) return false
  return !isTerminalStage(r, stages) && new Date(r.expectedCloseAt) < new Date(now.toDateString())
}

export type OpportunityAdviceAction = 'follow_up' | 'none'
export interface OpportunityAdviceRule { action: OpportunityAdviceAction; reasonKey: string }

const NONE_RULE: OpportunityAdviceRule = { action: 'none', reasonKey: 'koios.reasons.none' }

// First-match-wins rule: an overdue, still-open deal needs a follow-up.
export function deriveOpportunityAdvice(r: Opportunity, stages: LookupOption[], now?: Date): OpportunityAdviceRule {
  if (isExpectedCloseOverdue(r, stages, now)) return { action: 'follow_up', reasonKey: 'koios.reasons.expectedCloseOverdue' }
  return NONE_RULE
}
