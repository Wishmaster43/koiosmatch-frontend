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
import { useCachedLookup } from '@/lib/useCachedLookup'
import type { LookupOption } from '@/types/common'
// mapLookupResponse lives in lookupUtils.ts (DRY round 10, MISC — adopted next
// to lookupNames/normalizeOptions, its natural home).
import { mapLookupResponse } from '@/lib/lookupUtils'

// No seed — see the module doc comment above for why this hook is the exception.
const NO_STOP_REASONS: LookupOption[] = []

// The tenant's match termination reasons — no seed fallback on purpose (see file
// doc): an empty result must read as "not configured yet", never faked options.
export function useMatchStopReasons() {
  const { data: reasons, loading } = useCachedLookup('/match-stop-reasons?active=1', mapLookupResponse, NO_STOP_REASONS)
  return { reasons, loading }
}
