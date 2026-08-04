/**
 * matchDuration — pure "contract window" computation for the Overview tab
 * (M25/M26 of the overzicht-layout cluster): once a match carries BOTH a
 * start and end date, render the human duration (days/weeks/months) and how
 * far along today sits between them ("nog 53% te gaan"). Kept out of the
 * component so it is independently testable without mounting anything — `now`
 * is always injectable (never `Date.now()` inside an assertion), mirroring
 * matchExpiry.ts's pattern (§13).
 */

export interface MatchDuration {
  // Whole days spanned from start to end (inclusive of both ends' calendar days).
  totalDays: number
  // The most readable unit for the span (days under 2 weeks, weeks under 2 months, else months).
  unit: 'days' | 'weeks' | 'months'
  // The rounded amount in that unit (e.g. 6 weeks, 3 months).
  amount: number
  // 0–100, how far today sits between start and end (clamped; before start = 0, after end = 100).
  elapsedPct: number
  // 100 − elapsedPct — "nog X% te gaan".
  remainingPct: number
}

// Strip the time-of-day so day-math is always calendar-day accurate.
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const DAY_MS = 86_400_000

/**
 * Returns the duration/progress state for a match's contract window, or null
 * when either date is missing/unparseable or the end is not after the start
 * (an instant or inverted window has nothing meaningful to show).
 */
export function computeMatchDuration(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): MatchDuration | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  const totalMs = startOfDay(end) - startOfDay(start)
  if (totalMs <= 0) return null
  const totalDays = Math.round(totalMs / DAY_MS)

  // Pick the most readable unit for the span.
  let unit: MatchDuration['unit']
  let amount: number
  if (totalDays < 14) {
    unit = 'days'; amount = totalDays
  } else if (totalDays < 60) {
    unit = 'weeks'; amount = Math.round(totalDays / 7)
  } else {
    unit = 'months'; amount = Math.round(totalDays / 30.44)
  }

  const elapsedMs = startOfDay(now) - startOfDay(start)
  const elapsedPct = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)))
  const remainingPct = 100 - elapsedPct

  return { totalDays, unit, amount, elapsedPct, remainingPct }
}
