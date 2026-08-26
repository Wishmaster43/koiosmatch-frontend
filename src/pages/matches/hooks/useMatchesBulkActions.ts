/**
 * useMatchesBulkActions — bulk operations for MatchesPage. A match is read-only
 * (§3B: the continuation of a Hired application), so the only bulk
 * operations are row/all selection and authorization-gated *coupling* to an
 * external backoffice (HelloFlex / Shiftmanager). SYNC-BULK-1: `bulkCouple` is
 * built on the shared useBackofficeCoupleBulk (src/hooks/) now that candidates/
 * customers carry the exact same action — see its file doc for the endpoint/
 * toast contract. Matches keeps two behaviours the other two never had: a
 * per-reason skip breakdown (HF-CONTRACTMAP-1, below) and an 'info' (not
 * 'warning') tone on a partial queue, both passed in as params. Toasts come
 * from the shared notifier so a bulk action never fails silently (§10).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { notify } from '@/lib/notify'
import type { ToastType } from '@/lib/notify'
import { useBackofficeCoupleBulk } from '@/hooks/useBackofficeCoupleBulk'
import type { Id } from '@/types/common'

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
  const toggleRow = (id: Id) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const next = new Set(prev)
    ids.forEach(id => { if (allSelected) next.delete(id); else next.add(id) })
    return next
  })

  // HF-CONTRACTMAP-1: `skipped` may carry [{id, reason}] (mirrors the candidate
  // bulk BULK-SKIP-REASONS-1 pattern) — the resolver skips a match whose contract
  // form has no HelloFlex mapping yet with reason `helloflex_contract_type_unmapped`.
  // Group reasoned entries into a human "N reason" breakdown; falls back to '' for
  // the bare-id `skipped` shape other targets/routes still return (the shared
  // useBackofficeCoupleBulk falls back to the plain partial toast on an empty string).
  const reasonBreakdown = (skipped: unknown[]): string => {
    const reasoned = skipped.filter(
      (s): s is { id: Id; reason: string } => typeof s === 'object' && s !== null && 'reason' in s,
    )
    if (!reasoned.length) return ''
    const counts: Record<string, number> = {}
    reasoned.forEach(s => { counts[s.reason] = (counts[s.reason] ?? 0) + 1 })
    return Object.entries(counts)
      .map(([reason, count]) => `${count} ${t(`bulk.skipReasons.${reason}`, { defaultValue: reason })}`)
      .join(', ')
  }

  // Queues the selection for backoffice coupling via the shared bulk-sync endpoint
  // (see file doc above) — matches' own target-label lookup, reason breakdown and
  // 'info' partial tone are what set it apart from the candidate/customer callers.
  const bulkCouple = useBackofficeCoupleBulk({
    entity: 'matches', selectedIds, setSelectedIds, notify: notifyAny, t,
    targetLabel: target => t(`bulk.target.${target}`),
    reasonBreakdown,
    partialTone: 'info',
  })

  return {
    toggleRow,
    toggleAll,
    bulkCoupleHelloFlex:    () => bulkCouple('helloflex'),
    bulkCoupleShiftmanager: () => bulkCouple('shiftmanager'),
  }
}
