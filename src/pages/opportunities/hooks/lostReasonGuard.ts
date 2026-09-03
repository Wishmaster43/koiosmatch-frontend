/**
 * lostReasonGuard — OPP-LOST-FE-1's shared stage-change rule, extracted so every
 * path that can move an opportunity onto an is_lost stage (board drag + drawer
 * picker in useOpportunitiesData, and AddOpportunityModal's own edit-mode save)
 * reads ONE definition instead of three forked copies. A move needs the confirm
 * only when the target stage is flagged is_lost AND the tenant has curated ≥1
 * reason (an empty list means the field doesn't bind yet — no gate).
 */
import type { LookupOption } from '@/types/common'
import type { OpportunityLostReasonOption } from '@/lib/useOpportunityLostReasons'

// Whether moving to `stage` needs the lost-reason confirm before the PATCH/POST fires.
export function needsLostReason(stage: LookupOption | undefined, reasons: OpportunityLostReasonOption[]): boolean {
  return Boolean(stage?.isLost) && reasons.length > 0
}
