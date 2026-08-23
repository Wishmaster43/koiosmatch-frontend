/**
 * weekAggregation (BILLING-USAGE-REDESIGN-1) — pure FE-side day→ISO-week rollup
 * for the usage chart's Dag/Week view toggle. No backend aggregate exists (the
 * endpoint only returns per-day rows), so this is computed client-side from the
 * already-merged `DailyRow[]` (dailyUsageTypes.ts). Pure function, own unit tests
 * (see weekAggregation.test.ts) — never imported for its side effects.
 */
import type { DailyRow } from './dailyUsageTypes'

export interface WeekRow {
  // ISO week key, e.g. "2026-W34" — stable sort/group key and DataTable row id.
  weekKey: string
  // ISO week number (1-53), for the short "Wk 34" table/chart label.
  weekNumber: number
  // The Monday the ISO week starts on, as 'YYYY-MM-DD' — used to render a real
  // localized date range via the caller's own date formatter (never formatted here,
  // §5 — no manual string dates leave this pure util).
  weekStart: string
  workflowCredits: number
  workflowAmount: number
  aiInputTokens: number
  aiOutputTokens: number
  aiAmount: number
  totalAmount: number
}

// ISO-8601 week number + the Monday it starts on, for a 'YYYY-MM-DD' date string.
// Parsed as UTC noon (never local midnight) so DST transitions can never shift the
// date backward/forward a day — the exact bug class `toLocalIsoDate` exists to avoid
// elsewhere in this codebase.
function isoWeekOf(dateStr: string): { weekKey: string; weekNumber: number; weekStart: string } {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const dayNum = (d.getUTCDay() + 6) % 7 // Monday = 0 … Sunday = 6
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - dayNum)

  // ISO week 1 is the week containing the year's first Thursday.
  const thursday = new Date(monday)
  thursday.setUTCDate(monday.getUTCDate() + 3)
  const isoYear = thursday.getUTCFullYear()
  const jan1 = new Date(Date.UTC(isoYear, 0, 1))
  const weekNumber = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)

  const weekStart = monday.toISOString().slice(0, 10)
  return { weekKey: `${isoYear}-W${String(weekNumber).padStart(2, '0')}`, weekNumber, weekStart }
}

// Roll a day-granularity series up to ISO weeks. A week spanning a month boundary
// (or, at the edges of the picked period, a year boundary) still groups correctly —
// the key is derived from the ISO year of the week's own Thursday, not the day's
// calendar month. Empty input yields an empty result (no fabricated zero week).
export function aggregateToWeeks(rows: DailyRow[]): WeekRow[] {
  const byWeek = new Map<string, WeekRow>()
  for (const row of rows) {
    const { weekKey, weekNumber, weekStart } = isoWeekOf(row.date)
    const existing = byWeek.get(weekKey) ?? {
      weekKey, weekNumber, weekStart,
      workflowCredits: 0, workflowAmount: 0, aiInputTokens: 0, aiOutputTokens: 0, aiAmount: 0, totalAmount: 0,
    }
    existing.workflowCredits += row.workflowCredits
    existing.workflowAmount = Math.round((existing.workflowAmount + row.workflowAmount) * 100) / 100
    existing.aiInputTokens += row.aiInputTokens
    existing.aiOutputTokens += row.aiOutputTokens
    existing.aiAmount = Math.round((existing.aiAmount + row.aiAmount) * 100) / 100
    existing.totalAmount = Math.round((existing.totalAmount + row.totalAmount) * 100) / 100
    byWeek.set(weekKey, existing)
  }
  return Array.from(byWeek.values()).sort((a, b) => a.weekKey.localeCompare(b.weekKey))
}
