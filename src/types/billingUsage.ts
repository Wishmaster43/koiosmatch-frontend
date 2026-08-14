/**
 * Billing/usage response shapes — CREDITS-1 fase 1 (§9-reparatie: sale-price keys
 * only, never purchase/margin outside the superadmin block). The generated OpenAPI
 * spec only documents the 401 error for these routes today (no 2xx schema yet, see
 * CLAUDE.md §10), so every shape below is HAND-WRITTEN from the contract in
 * koiosmatch-api/docs/contract/CONTRACT-CHANGELOG.md ("CREDITS-1 fase 1").
 */

// GET /ai/koios/usage?period=today|month — own-organisation Koios AI usage.
// BREAKING (CREDITS-1): totals.cost -> totals.amount; per_activity[].cost -> amount;
// forecast.avg_daily_cost/projected_month_cost -> avg_daily_amount/projected_month_amount.
export interface KoiosUsageTotals {
  calls?: number
  input_tokens?: number
  output_tokens?: number
  amount?: number
  currency?: string
}
export interface KoiosUsagePerActivity {
  activity: string
  calls?: number
  input_tokens?: number
  output_tokens?: number
  amount?: number
}
export interface KoiosUsageForecast {
  avg_daily_amount?: number
  projected_month_amount?: number
  currency?: string
}
export interface KoiosUsageResponse {
  totals?: KoiosUsageTotals
  per_user?: Array<{ user_id?: string; name?: string; calls?: number; input_tokens?: number; output_tokens?: number; amount?: number }>
  per_activity?: KoiosUsagePerActivity[]
  forecast?: KoiosUsageForecast | null
}

// GET /ai/koios/usage/daily?period=today|month — day x category series for the graph.
// BREAKING (CREDITS-1): series[].cost -> series[].amount.
export interface KoiosUsageDailyResponse {
  series?: Array<{ date: string; category?: string; amount?: number }>
  currency?: string
}

// GET /ai/koios/usage/summary?period=today|month — period totals + per-category.
// BREAKING (CREDITS-1): total_cost -> total_amount; by_category[].cost -> amount.
export interface KoiosUsageSummaryResponse {
  total_amount?: number
  currency?: string
  by_category?: Array<{ category: string; amount?: number }>
}

// GET /ai/koios/usage/billing?month=YYYY-MM — invoice-ready Claude + workflow totals.
// BREAKING (CREDITS-1): claude.cost and claude.margin_pct are REMOVED (purchase-price
// leak, §9-reparatie); claude.billable_cost stays (the actual sale price).
export interface KoiosBillingClaude {
  tokens_in?: number
  tokens_out?: number
  free_allowance?: number
  billable_cost?: number
}
export interface KoiosBillingWorkflow {
  total_module_runs?: number
  per_module?: Record<string, number>
  price_cents_per_run?: number
  amount?: number
}
export interface KoiosUsageBillingResponse {
  claude?: KoiosBillingClaude
  workflow?: KoiosBillingWorkflow
  total_amount?: number
  currency?: string
}

// GET /billing/usage?period=month|prev_month&from=&to= (billing.view permission,
// the new #settings/billing/billing_usage screen). Sale-price only — no purchase/
// margin here, that lives on the superadmin tenant-usage screen only.
export interface BillingUsageWorkflow {
  total_credits?: number
  // Unrounded as delivered by the backend (can be a sub-cent fraction like 0.005) —
  // NEVER round this client-side, render every decimal the API sends (§ contract).
  credit_price?: number
  amount?: number
  per_day?: Array<{ date: string; credits?: number }>
  per_workflow?: Array<{ workflow_id: string; name?: string; runs?: number; credits?: number }>
}
export interface BillingUsageAiPerUser {
  user_id: string
  name?: string
  input_tokens?: number
  output_tokens?: number
  amount?: number
  calls?: number
  success_rate?: number
}
export interface BillingUsageAi {
  input_tokens?: number
  output_tokens?: number
  amount?: number
  per_day?: Array<{ date: string; input_tokens?: number; output_tokens?: number; amount?: number }>
  per_user?: BillingUsageAiPerUser[]
}
export interface BillingUsageResponse {
  data: { workflow: BillingUsageWorkflow; ai: BillingUsageAi }
}

// GET/PUT /admin/platform-pricing — superadmin-only platform pricing knobs.
export interface PlatformPricing {
  ai_markup_percent: number
  workflow_credit_price: number
}

// GET /admin/tenants/{tenant}/usage/details?month=YYYY-MM&group_by=activity|model|user|day
// Superadmin-only detail breakdown alongside the monthly usage total (CMBE, 14-08).
// HAND-WRITTEN: the generated OpenAPI spec does not carry a 2xx schema for this route
// yet (CLAUDE.md §10). Per CMBE contract: the sum of `rows[].requests/tokens/cost`
// over any group_by equals the corresponding /usage total for that month (server-tested),
// and rows with no user_id come back under the sentinel key "__system__" with
// label "System / unattributed" — that row must always render, never be filtered out.
export type AdminUsageDetailsAxis = 'activity' | 'model' | 'user' | 'day'
export interface AdminUsageDetailsRow {
  key: string
  // Resolved display name — only present for group_by=user (incl. the "__system__" sentinel).
  label?: string
  requests?: number
  input_tokens?: number
  output_tokens?: number
  // Sale-side cost, computed with the same formula as the /usage block (never drifts).
  cost?: number
}
export interface AdminUsageDetailsResponse {
  group_by: AdminUsageDetailsAxis
  month: string
  rows: AdminUsageDetailsRow[]
}
