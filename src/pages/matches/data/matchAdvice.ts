/**
 * matchAdvice — the ONE deterministic rule engine behind the matches table's
 * "Koios" column. Mirrors candidateAdvice.ts's reference design: rules only
 * read fields the LIST row already carries (endDate, archived) plus the
 * caller-resolved `isClosed` flag (from the tenant's /match-statuses lookup,
 * R-1b) — no new fetch, no invented data.
 */
import type { MatchRow } from '@/types/match'

export type MatchAdviceAction = 'renew' | 'none'

export interface MatchAdviceRule {
  action: MatchAdviceAction
  reasonKey: string
  reasonParams?: Record<string, string | number>
}

export interface MatchAdviceOptions {
  // The match's CURRENT status is_closed flag (open vs. closed lifecycle, R-1b)
  // — a closed match is over, renewing it makes no sense.
  isClosed: boolean
  // How many days before (or past) the end date counts as "approaching"
  // (tenant-configurable, mirrors vacancies' staleDays).
  renewWithinDays: number
  now?: Date
}

const NONE_RULE: MatchAdviceRule = { action: 'none', reasonKey: 'koios.reasons.none' }

// First-match-wins priority ladder  for the read-set constraint.
export function deriveMatchAdvice(m: MatchRow, opts: MatchAdviceOptions): MatchAdviceRule {
  // Rule 1: no advice on an archived (soft-deleted) match.
  if (m.archived) return NONE_RULE

  // Rule 2: a closed match already ended — nothing left to renew.
  if (opts.isClosed) return NONE_RULE

  // Rule 3: an open match with no end date runs indefinitely — nothing to flag.
  if (!m.endDate) return NONE_RULE

  // Rule 4: the end date is within the renewal window, or already passed while
  // still open — Danny's own example rule ("einddatum nadert → Verlengen?" —
  // "end date approaching → Renew?").
  const end = new Date(m.endDate)
  if (Number.isNaN(end.getTime())) return NONE_RULE
  const now = opts.now ?? new Date()
  const daysUntilEnd = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntilEnd <= opts.renewWithinDays) {
    return { action: 'renew', reasonKey: 'koios.reasons.endDateApproaching', reasonParams: { days: daysUntilEnd } }
  }

  // Rule 5: nothing to flag.
  return NONE_RULE
}
