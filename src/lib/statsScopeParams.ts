/**
 * pickStatsScopeParams — narrows a page's full filterParams down to the VIEW-SCOPE
 * subset a server-wide `/…/stats` request may carry (§3B: KPI/donut counts are
 * server-wide, never page/filter-scoped). Measured 2026-08-22 across the four
 * entity pages (candidates/applications/vacancies/customers): every one of them
 * was sending the FULL filterParams — including every dimension/attention/
 * click-to-filter key (status, owner_id, search, intake_planned, …) — straight
 * into its stats query, so activating any KPI filter collapsed the whole KPI row
 * to the filtered subset (zeros everywhere once the subset excluded a bucket).
 * Only a param that changes what the dataset ITSELF is — today the soft-delete
 * reveal flag shared by every entity's archived/trash quick views — belongs in
 * a stats request; a dimension pick (including a status value like "blacklist")
 * must keep the KPI row on the stable server-wide totals while it narrows the list.
 */
const STATS_SCOPE_KEYS = ['include_archived'] as const

// Pick only the whitelisted keys that are actually present, so a stats request
// never carries an explicit `undefined`/falsy entry the list never sent either.
export function pickStatsScopeParams(filterParams: Record<string, unknown>): Record<string, unknown> {
  const scoped: Record<string, unknown> = {}
  for (const key of STATS_SCOPE_KEYS) {
    if (key in filterParams) scoped[key] = filterParams[key]
  }
  return scoped
}
