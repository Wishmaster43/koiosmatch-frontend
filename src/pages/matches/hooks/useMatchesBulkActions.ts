/**
 * useMatchesBulkActions — bulk operations for MatchesPage. A match is read-only
 * (§3B: the continuation of a Hired application), so the only bulk
 * operations are row/all selection and authorization-gated *coupling* to an
 * external backoffice (HelloFlex / Shiftmanager). SYNC-BULK-1: `bulkCouple` is
 * built on the shared useBackofficeCoupleBulk (src/hooks/) now that candidates/
 * customers carry the exact same action. HelloFlex overrides the route through
 * its `buildRequest` (POST /matches/bulk/couple, module-gated); Shiftmanager stays
 * on the generic sync path — see the hook's file doc for the toast contract. Matches keeps two behaviours the other two never had: a
 * per-reason skip breakdown (HF-CONTRACTMAP-1, below) and an 'info' (not
 * 'warning') tone on a partial queue, both passed in as params. Toasts come
 * from the shared notifier so a bulk action never fails silently (§10).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { notify } from '@/lib/notify'
import type { ToastType } from '@/lib/notify'
import { reasonBreakdown as computeReasonBreakdown } from '@/lib/bulkSkipReasons'
import { useBackofficeCoupleBulk } from '@/hooks/useBackofficeCoupleBulk'
import { useBulkSelectionToggles } from '@/hooks/useBulkSelectionToggles'
import type { Id } from '@/types/common'
import type { operations } from '@/types/api-generated'

// HelloFlex bulk-couple request body, typed from the generated spec (match ids are UUID strings at runtime).
type HelloflexCoupleBody = operations['postMatchesBulkCouple']['requestBody']['content']['application/json']

export type CoupleTarget = 'helloflex' | 'shiftmanager'

// Adapts the strictly-typed global notify (ToastType only) to the shared hook's
// loose (type: string) signature — matches only ever passes 'info'/'success'/'error'.
const notifyAny = (type: string, msg: string) => notify(type as ToastType, msg)

interface UseMatchesBulkActionsArgs {
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  t: TFunction
}

export function useMatchesBulkActions({ selectedIds, setSelectedIds, t }: UseMatchesBulkActionsArgs) {
  // ── Bulk selection ──
  const { toggleRow, toggleAll } = useBulkSelectionToggles(setSelectedIds)

  // HF-CONTRACTMAP-1: `skipped` may carry [{id, reason, reason_code?}] (mirrors the
  // candidate bulk BULK-SKIP-REASONS-1 pattern) — HF-CONTRACT-1 sends a coarse reason
  // (not_found | already_coupled | needs_contract_fields) and, for the last, a specific
  // `reason_code` (e.g. helloflex_contract_type_unmapped) that wins in the breakdown.
  // Group reasoned entries into a human "N reason" breakdown; falls back to '' for
  // the bare-id `skipped` shape other targets/routes still return (the shared
  // useBackofficeCoupleBulk falls back to the plain partial toast on an empty string).
  const reasonBreakdown = (skipped: unknown[]): string => computeReasonBreakdown(skipped, t)

  // Queues the selection for backoffice coupling via the shared bulk-sync endpoint
  // (see file doc above) — matches' own target-label lookup, reason breakdown and
  // 'info' partial tone are what set it apart from the candidate/customer callers.
  const bulkCouple = useBackofficeCoupleBulk({
    entity: 'matches', selectedIds, setSelectedIds, notify: notifyAny, t,
    targetLabel: target => t(`bulk.target.${target}`),
    reasonBreakdown,
    partialTone: 'info',
    // HF-CONTRACT-1: HelloFlex has its own gated route; Shiftmanager stays on the generic sync path.
    buildRequest: (target, ids) => target === 'helloflex' ? { url: '/matches/bulk/couple', body: { match_ids: ids as string[], target } satisfies HelloflexCoupleBody } : null,
    moduleGatedTargets: ['helloflex'],
  })

  return {
    toggleRow,
    toggleAll,
    bulkCoupleHelloFlex:    () => bulkCouple('helloflex'),
    bulkCoupleShiftmanager: () => bulkCouple('shiftmanager'),
  }
}
