/**
 * dailyUsageTypes — the shared per-day usage row shape + the merge that builds it
 * from the two `/billing/usage` per-day series (workflow credits, AI tokens/amount).
 * Split out of UsageDailySection (USAGE-DAILY-1) so the new chart/KPI/table
 * subcomponents and the week-aggregation util (weekAggregation.ts) share ONE type
 * instead of three drifting copies.
 */
import type { BillingUsageResponse } from '@/types/billingUsage'

// One merged day row — workflow (credits/amount) + ai (tokens/amount). Dates with
// activity on only one side still render (zero-filled on the other side).
export interface DailyRow {
  date: string
  workflowCredits: number
  workflowAmount: number
  aiInputTokens: number
  aiOutputTokens: number
  aiAmount: number
  totalAmount: number
}

// Merge the two per-day arrays keyed by date, computing each day's workflow
// amount from credits × overage_price (the endpoint only sends the amount total,
// not a per-day amount, for workflow — mirrors the backend export merge).
export function mergeDailyRows(data: BillingUsageResponse['data'] | undefined): DailyRow[] {
  const creditPrice = data?.workflow?.overage_price ?? 0
  const byDate = new Map<string, DailyRow>()
  for (const row of data?.workflow?.per_day ?? []) {
    const credits = row.credits ?? 0
    byDate.set(row.date, {
      date: row.date, workflowCredits: credits, workflowAmount: Math.round(credits * creditPrice * 100) / 100,
      aiInputTokens: 0, aiOutputTokens: 0, aiAmount: 0, totalAmount: 0,
    })
  }
  for (const row of data?.ai?.per_day ?? []) {
    const existing = byDate.get(row.date) ?? {
      date: row.date, workflowCredits: 0, workflowAmount: 0, aiInputTokens: 0, aiOutputTokens: 0, aiAmount: 0, totalAmount: 0,
    }
    existing.aiInputTokens = row.input_tokens ?? 0
    existing.aiOutputTokens = row.output_tokens ?? 0
    existing.aiAmount = row.amount ?? 0
    byDate.set(row.date, existing)
  }
  const rows = Array.from(byDate.values()).map(r => ({ ...r, totalAmount: Math.round((r.workflowAmount + r.aiAmount) * 100) / 100 }))
  rows.sort((a, b) => a.date.localeCompare(b.date))
  return rows
}
