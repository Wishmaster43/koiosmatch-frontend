/**
 * matchExpiry — pure "is this match's end date approaching/past" computation
 * (Danny's point 6: a soft-tint warning within 30 days, danger once past).
 * Kept out of MatchCard so it is independently testable without mounting a
 * component — `now` is injectable (never `Date.now()` inside an assertion)
 * so tests stay deterministic with fixed fixture dates, per CLAUDE.md §13.
 */

export interface MatchExpiryState {
  kind: 'expired' | 'warning'
  days: number
}

// Strip the time-of-day so "today" always reads as day 0, regardless of hour.
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Returns the expiry state for a match's end date, or null when there is
 * nothing to warn about (no end date, an unparseable value, or the match is
 * already closed/archived — a finished match never needs an expiry nag).
 */
export function computeMatchExpiry(
  endDate: string | null | undefined,
  opts: { closed?: boolean; now?: Date } = {},
): MatchExpiryState | null {
  if (!endDate || opts.closed) return null
  const end = new Date(endDate)
  if (isNaN(end.getTime())) return null
  const now = opts.now ?? new Date()
  const days = Math.round((startOfDay(end) - startOfDay(now)) / 86_400_000)
  if (days <= 0) return { kind: 'expired', days }
  if (days <= 30) return { kind: 'warning', days }
  return null
}
