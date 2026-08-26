/**
 * useBackofficeCoupleBulk — the shared "queue selection for backoffice coupling"
 * bulk action (SYNC-BULK-1, §3B — bulk is the 3rd of the three coupling paths:
 * manual/bulk/workflow). Shares the ONE generic POST /sync/{entity}/bulk endpoint
 * the per-record BackofficeLinksTab already uses. That endpoint returns
 * { queued, skipped } — NOT the `updated` shape bulkMutate reconciles on — so this
 * stays a small dedicated adapter: nothing on the row changes visibly on QUEUE (no
 * optimistic patch), and the toast stays honest — "queued", never "done" — plus the
 * skipped count so a matrix block or an unknown/other-tenant id is never silently
 * swallowed.
 *
 * Hand-copied three times (candidates/customers/matches) before this consolidation.
 * Matches had grown two behaviours the other two never had — a per-reason skip
 * breakdown (HF-CONTRACTMAP-1) and an 'info' (not 'warning') tone on a partial
 * queue — both kept here as opt-in params so every consumer's behaviour stays
 * byte-for-byte what it was before.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api, { isServiceUnavailable } from '@/lib/api'
import type { Id } from '@/types/common'

export type CoupleTarget = 'helloflex' | 'shiftmanager'

interface UseBackofficeCoupleBulkArgs {
  // The /sync/{entity}/bulk path segment ('candidates' | 'customers' | 'matches').
  entity: string
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
  // Resolves a target system to its display name; each entity keeps its own i18n key.
  targetLabel: (target: CoupleTarget) => string
  // HF-CONTRACTMAP-1 (matches only): groups a reasoned `skipped` array into a
  // human breakdown string, driving the *Reasoned toast variant when non-empty.
  reasonBreakdown?: (skipped: unknown[]) => string
  // Tone of the partial-queue toast — matches uses 'info', candidates/customers 'warning'.
  partialTone?: 'warning' | 'info'
}

// Builds the bulkCoupleBackoffice(system) action shared by candidates/customers/matches (see file doc above).
export function useBackofficeCoupleBulk({ entity, selectedIds, setSelectedIds, notify, t, targetLabel, reasonBreakdown, partialTone = 'warning' }: UseBackofficeCoupleBulkArgs) {
  return (system: CoupleTarget) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setSelectedIds(new Set())
    const label = targetLabel(system)
    api.post(`/sync/${entity}/bulk`, { ids, system })
      .then((res) => {
        const queued = Array.isArray(res.data?.queued) ? res.data.queued.length : 0
        const skippedArr = Array.isArray(res.data?.skipped) ? res.data.skipped : []
        const skipped = skippedArr.length
        if (skipped > 0) {
          const breakdown = reasonBreakdown?.(skippedArr)
          if (breakdown) notify(partialTone, t('bulk.coupleQueuedPartialReasoned', { target: label, queued, total: queued + skipped, skipped, breakdown }))
          else notify(partialTone, t('bulk.coupleQueuedPartial', { target: label, queued, total: queued + skipped, skipped }))
        } else notify('success', t('bulk.coupleQueued', { target: label, count: queued }))
      })
      .catch((err) => {
        // 404 (route not yet deployed) and 503 (module not configured for this
        // tenant) both read as "not available right now", never a hard error.
        if (err?.response?.status === 404 || isServiceUnavailable(err)) notify('info', t('bulk.coupleUnavailable'))
        else notify('error', t('bulk.mutateError'))
      })
  }
}
