/**
 * customerInsights — pure helpers for the customers page status donut (Danny
 * 02-08: "bij de status-donut tonen we prospect als status — kijk af bij
 * kandidaat", mirrors src/pages/candidates/data/candidateInsights.tsx). The
 * '__none' bucket represents customers still in the ENTRY phase (Prospect) — no
 * deployability status yet — so clicking that segment must filter the PHASE
 * axis, never the status axis. Both helpers key on the PHASE, never on the
 * (retiring) customer_statuses 'prospect' value, so nothing here needs to change
 * once the backend finishes removing that value (COORDINATION-LOG 2026-08-02).
 * No hooks, no state — everything arrives as arguments, so this is trivially
 * unit-testable without rendering CustomersPage's many hooks/contexts.
 */

/** The synthetic donut-segment key for "no deployability status yet". */
export const NO_STATUS_KEY = '__none'

/** One donut-ready status bucket (mirrors the page's local `Opt` shape + a colour). */
export interface CustomerStatusOpt {
  value: string
  label: string
  color?: string
  count: number
}

interface StatsByStatusRow { value?: string; status?: string; count?: number }
interface StatusLookupRow { value: string; label: string; color?: string }
interface EntryPhaseMeta { label: string; color?: string }
// Customer.status is typed string|number for legacy/API reasons (mirrors other
// scalar identifiers in types/customer.ts) — accept either, compared as a string.
interface CustomerRow { status?: string | number | null; phase?: string | null }

/**
 * Routes a clicked donut segment to the right filter axis. The no-status bucket
 * picks the tenant's ENTRY phase; every other segment picks its own status value,
 * unchanged from before this bucket existed.
 */
export function pickCustomerStatusSegment(
  key: string | undefined,
  entryPhaseValue: string | undefined,
): { axis: 'phase' | 'status'; value: string | undefined } {
  if (key === NO_STATUS_KEY) return { axis: 'phase', value: entryPhaseValue }
  return { axis: 'status', value: key }
}

/**
 * Builds the status donut buckets. Prefers the server-wide stats.by_status total
 * (an empty/falsy value there = "no status assigned" — the shape a fully-migrated
 * backend will send for entry-phase customers); falls back to counting the loaded
 * page, where the ENTRY PHASE decides the bucket directly — an entry-phase customer
 * counts as '__none' regardless of whatever raw status value it still carries.
 */
export function buildCustomerStatusOptions({
  statsByStatus, customers, statuses, entryPhase, entryPhaseValue, noStatusFallbackLabel,
}: {
  statsByStatus?: StatsByStatusRow[]
  customers: CustomerRow[]
  statuses: StatusLookupRow[]
  entryPhase?: EntryPhaseMeta
  entryPhaseValue?: string
  noStatusFallbackLabel: string
}): CustomerStatusOpt[] {
  if (statsByStatus) {
    return statsByStatus.map(o => {
      const v = o.value ?? o.status ?? ''
      if (!v) return { value: NO_STATUS_KEY, label: entryPhase?.label ?? noStatusFallbackLabel, color: entryPhase?.color, count: o.count ?? 0 }
      const meta = statuses.find(s => s.value === v)
      return { value: v, label: meta?.label ?? v, color: meta?.color, count: o.count ?? 0 }
    })
  }

  // Fallback (page-derived): bucket by PHASE first — an entry-phase customer has
  // no status yet no matter what raw status value it carries — then by literal
  // status for everyone past the entry phase.
  const nonEntry = customers.filter(c => c.phase !== entryPhaseValue)
  const entryCount = customers.length - nonEntry.length
  const opts: CustomerStatusOpt[] = []
  if (entryCount > 0) opts.push({ value: NO_STATUS_KEY, label: entryPhase?.label ?? noStatusFallbackLabel, color: entryPhase?.color, count: entryCount })
  statuses.forEach(s => {
    const count = nonEntry.filter(c => String(c.status ?? '') === s.value).length
    if (count > 0) opts.push({ value: s.value, label: s.label, color: s.color, count })
  })
  return opts
}
