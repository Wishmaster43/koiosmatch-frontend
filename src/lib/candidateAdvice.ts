import type { Candidate } from '@/types/candidate'

/**
 * candidateAdvice — the ONE deterministic rule engine behind the "Koios" advice,
 * shared by the candidates TABLE column and the drawer "Koios AI adviseert" block.
 *
 * CRITICAL DESIGN CONSTRAINT: rules may ONLY read fields that exist on BOTH the
 * list row and the detail record (phase, status, stage, pools, lastContactAt,
 * archived/lifecycle). Profile completeness (summary/dob/address/…) must NEVER
 * drive the action — the list row never carries those fields, and that exact
 * asymmetry is what made the table and the drawer disagree (Danny 25-07).
 */

export type CandidateAdviceAction = 'contact' | 'plan_intake' | 'add_to_pool' | 'none'

export interface CandidateAdviceRule {
  action: CandidateAdviceAction
  reasonKey: string
  reasonParams?: Record<string, string | number>
}

export interface CandidateAdviceOptions {
  staleMonths: number
  entryPhase: string
  isBlacklist: boolean
  // Injectable for deterministic tests; defaults to the real clock at call time.
  now?: Date
}

const NONE_RULE: CandidateAdviceRule = { action: 'none', reasonKey: 'koios.reasons.none' }

// First-match-wins priority ladder — see the file header for the read-set constraint.
export function deriveCandidateAdvice(c: Candidate, opts: CandidateAdviceOptions): CandidateAdviceRule {
  // Rule 1: no advice on an archived/erasing dossier.
  if (c.lifecycle !== 'active' || c.archived) return NONE_RULE

  // Rule 2: no advice on a blacklisted candidate.
  if (opts.isBlacklist) return NONE_RULE

  const lastContact = c.lastContactAt ?? c.lastContactDate
  const now = opts.now ?? new Date()

  // Rule 3: never contacted at all — highest-priority actionable advice.
  if (!lastContact) return { action: 'contact', reasonKey: 'koios.reasons.neverContacted' }

  // Rule 4: last contact older than the tenant's stale-contact threshold.
  const monthsSince = monthsBetween(new Date(lastContact), now)
  if (monthsSince >= opts.staleMonths) {
    return { action: 'contact', reasonKey: 'koios.reasons.staleContact', reasonParams: { months: opts.staleMonths } }
  }

  // Rule 5: a Lead with no application yet — needs an intake to qualify.
  if (c.phase === opts.entryPhase && !c.stage) {
    return { action: 'plan_intake', reasonKey: 'koios.reasons.leadNoApplication' }
  }

  // Rule 6: not in any talent pool yet.
  if ((c.pools ?? []).length === 0) return { action: 'add_to_pool', reasonKey: 'koios.reasons.noPool' }

  // Rule 7: nothing to flag.
  return NONE_RULE
}

// Whole-month difference between two dates (fractional months round down).
function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear()
  const months = to.getMonth() - from.getMonth()
  let total = years * 12 + months
  if (to.getDate() < from.getDate()) total -= 1
  return Math.max(0, total)
}
