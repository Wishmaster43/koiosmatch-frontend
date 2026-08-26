/**
 * useMatchStopReasons — tenant-configurable termination reasons for the match
 * "Beëindigen" flow (MATCH-TERMINATE-1). Fed by GET /match-stop-reasons
 * ({value/slug,label,color}). Deliberately NO seed fallback (unlike every other
 * lookup hook in this codebase, e.g. useOutreachOutcomes): this is a brand-new
 * tenant-managed vocabulary — a hardcoded seed would let the modal offer values
 * the backend's `match_stop_reasons.value` table doesn't actually contain (§3B
 * "nothing hardcoded"). An empty result is surfaced honestly by the modal
 * ("no reasons configured") rather than faked with demo options.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// No seed — see the module doc comment above for why this hook is the exception.
const NO_STOP_REASONS: LookupOption[] = []

// Normalise an API row (id/name/label/value/color) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
})

// null = nothing usable in this response — useCachedLookup keeps the empty
// fallback and retries on the next mount (mirrors every other lookup hook).
const mapMatchStopReasons = (res: AxiosResponse): LookupOption[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toOption) : null
}

// The tenant's match termination reasons — no seed fallback on purpose (see file
// doc): an empty result must read as "not configured yet", never faked options.
export function useMatchStopReasons() {
  const { data: reasons, loading } = useCachedLookup('/match-stop-reasons', mapMatchStopReasons, NO_STOP_REASONS)
  return { reasons, loading }
}
