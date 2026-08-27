/**
 * useCandidateArchiveBulk — the bulk archive-guard cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): a pre-check
 * (capped) of the selection for a live application/active match, the aggregate
 * guard modal it opens when blockers are found, and the actual bulk archive
 * call (also re-used once the guard modal resolves every blocker). A 409 with
 * the forward-compat `{ live }` payload re-opens the guard instead of a bare
 * error toast. `notifyOutcome` is owned by the parent hook (shared across
 * every bulk cluster) and passed in so there is exactly one implementation of it.
 */
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { needsLiveCheck, fetchLiveBlockers, liveFromError } from '../data/archiveGuard'
import type { BlockingApplication, BlockingMatch } from '../data/archiveGuard'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

// Bulk archive-guard modal state (§3B) — aggregate mode: N of the selection
// carry a live application/match; the same resolutions apply to all of them.
export interface BulkArchiveGuardTarget {
  ids: Id[]
  blockedCount: number
  totalCount: number
  applications: BlockingApplication[]
  matches: BlockingMatch[]
}
// Pre-check is bounded — a huge selection shouldn't fire dozens of detail
// fetches just to open a bulk-archive confirm; beyond the cap the 409
// forward-compat catch on the actual bulk call is the safety net.
const BULK_GUARD_CHECK_CAP = 25

// Narrow shape of useConfirm's `confirm` this cluster needs — structurally
// compatible with the real (broader-optioned) function passed in by the parent.
type ConfirmFn = (message: string, onConfirm: () => void, options?: { danger?: boolean }) => void

interface UseCandidateArchiveBulkParams {
  candidates: Candidate[]
  setCandidates: Dispatch<SetStateAction<Candidate[]>>
  setTotal: Dispatch<SetStateAction<number>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
  funnelTypes: LookupItem[]
  confirm: ConfirmFn
  notifyOutcome: (successKey: string, params: Record<string, unknown>, updated: number, total: number) => void
}

export function useCandidateArchiveBulk({
  candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, confirm, notifyOutcome,
}: UseCandidateArchiveBulkParams) {
  // Archive-guard modal state (§3B) — set when the pre-check (or a 409 from the
  // actual call) finds candidates with a live application/active match.
  const [bulkArchiveGuard, setBulkArchiveGuard] = useState<BulkArchiveGuardTarget | null>(null)

  // The actual bulk archive call — also re-used once the guard modal resolves
  // every blocker. A 409 with the forward-compat `{ live }` payload re-opens the
  // guard (whole-selection aggregate) instead of a bare error toast.
  const runBulkArchive = (ids: Id[]) => {
    api.post('/candidates/bulk/archive', { candidate_ids: ids })
      .then((res) => {
        const archived: Id[] = Array.isArray(res.data?.archived) ? res.data.archived : ids
        const set = new Set(archived)
        setCandidates(prev => prev.filter(c => !set.has(c.id)))
        setTotal(tt => Math.max(0, tt - archived.length))
        notifyOutcome('bulk.archived', {}, archived.length, ids.length)
      })
      .catch((e) => {
        const live = liveFromError(e)
        if (live) { setBulkArchiveGuard({ ids, blockedCount: ids.length, totalCount: ids.length, ...live }); return }
        notify('error', t('bulk.archiveError'))
      })
  }

  // Archive (soft-delete) the selection. Pre-checks the (row-flagged, capped)
  // subset for live applications/matches first; any blocked candidate opens the
  // guard modal in aggregate mode instead of the plain confirm dialog.
  const bulkArchive = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setSelectedIds(new Set())
    const byId = new Map(candidates.map(c => [c.id, c]))
    const risky = ids.filter(id => needsLiveCheck(byId.get(id), funnelTypes))
    const toCheck = risky.slice(0, BULK_GUARD_CHECK_CAP)
    const checks = await Promise.all(toCheck.map(async id => ({ id, blockers: await fetchLiveBlockers(id) })))
    const blocked = checks.filter(c => c.blockers.applications.length || c.blockers.matches.length)
    if (blocked.length) {
      const name = (id: Id) => byId.get(id)?.name
      setBulkArchiveGuard({
        ids, blockedCount: blocked.length, totalCount: ids.length,
        applications: blocked.flatMap(b => b.blockers.applications.map(a => ({ ...a, candidateName: name(b.id) }))),
        matches: blocked.flatMap(b => b.blockers.matches.map(m => ({ ...m, candidateName: name(b.id) }))),
      })
      return
    }
    confirm(t('bulk.archiveConfirm', { count: ids.length }), () => runBulkArchive(ids), { danger: true })
  }

  // The modal's primary action: every blocker resolved → run the real bulk archive.
  const resolveBulkArchiveGuard = () => {
    if (!bulkArchiveGuard) return
    const { ids } = bulkArchiveGuard
    setBulkArchiveGuard(null)
    runBulkArchive(ids)
  }

  return { bulkArchive, bulkArchiveGuard, setBulkArchiveGuard, resolveBulkArchiveGuard }
}
