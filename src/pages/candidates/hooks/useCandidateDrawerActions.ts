/**
 * useCandidateDrawerActions — drawer open/close state + the single-record
 * lifecycle mutations of the candidates page (§0.3 split from CandidatesPage):
 * select (light row → full record fetch, ARCH-3 aware), archive, restore,
 * mark-for-deletion (ERASE-1) and the hard-delete preview flow. The list
 * updates (remove row, total--) stay optimistic; the backend re-checks (§3B).
 *
 * Archive/mark-deletion are GUARDED (§3B, ARCHIVE-GUARD): a candidate must
 * never move to Gearchiveerd/Prullenbak while a live application or active
 * match still hangs on it. A cheap row-level check decides whether the full
 * live-blockers fetch is worth it; if it finds any, the ArchiveGuardModal
 * opens instead of calling the API. The 409 catch is the safety net in case
 * that heuristic (or the backend guard, once shipped) disagrees.
 */
import { useState, useRef } from 'react'
import api from '@/lib/api'
import { useCandidateRecord } from './useCandidateMutations'
import { needsLiveCheck, fetchLiveBlockers, liveFromError } from '../data/archiveGuard'
import type { BlockingApplication, BlockingMatch } from '../data/archiveGuard'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// The archive-guard modal's target: which candidate, which flow (archive vs
// trash) and the blockers to list + resolve.
export interface ArchiveGuardTarget {
  candidateId: Id
  candidateName: string
  mode: 'archive' | 'trash'
  applications: BlockingApplication[]
  matches: BlockingMatch[]
}

interface Args {
  candidates: Candidate[]
  setCandidates: (fn: (prev: Candidate[]) => Candidate[]) => void
  setTotal: (fn: (prev: number) => number) => void
  // Optional action renders as a link-button in the page banner (e.g. "Openen").
  notifyMsg: (msg: { type: string; text: string; action?: { label: string; onClick: () => void } }) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

export function useCandidateDrawerActions({ candidates, setCandidates, setTotal, notifyMsg, t }: Args) {
  const [selected,       setSelected]       = useState<Candidate | null>(null)
  const [detail,         setDetail]         = useState<Candidate | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  // Deep-link target tab (contact-cell → communication, funnel-chip → work); row click = default.
  const [drawerTab,      setDrawerTab]      = useState<string | undefined>(undefined)
  const selectedIdRef = useRef<Id | null>(null)

  // Full-record load + edit persistence (fetch/PATCH live in the hook, §3).
  const { fetchDetail, patchCandidate } = useCandidateRecord()

  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }

  // Open a candidate: hand the light row to the drawer, then fetch the full record.
  // 404 ('gone') = a stale row (reseed / deleted elsewhere) → drop it + tell the user.
  const selectCandidate = (c: Candidate, tab?: string) => {
    setDrawerTab(tab)
    selectedIdRef.current = c.id
    setSelected(c); setDetail(null); setDrawerExpanded(false)
    // ARCHIVED rows: the detail endpoint 404s for soft-deleted records (ARCH-3, BE) —
    // open the drawer on the row data (banner + restore) instead of "bestaat niet meer".
    if (c.archived) return
    fetchDetail(c.id).then(full => {
      if (selectedIdRef.current !== c.id) return
      if (full === 'gone') {
        setCandidates(p => p.filter(x => x.id !== c.id))
        setTotal(v => Math.max(0, v - 1))
        closeDrawer()
        notifyMsg({ type: 'error', text: t('drawer.recordGone') })
        return
      }
      if (full) setDetail(full)
    })
  }

  // Shared shape of every lifecycle mutation: call → drop row → close → toast.
  // A 409 carrying the forward-compat `{ live }` guard payload opens the guard
  // modal instead of the generic failure toast (point 4 of the ARCHIVE-GUARD spec).
  const lifecycleCall = async (call: () => Promise<unknown>, id: Id, okKey: string, failKey: string, guardMode?: 'archive' | 'trash') => {
    try {
      await call()
      setCandidates(p => p.filter(x => x.id !== id))
      setTotal(v => Math.max(0, v - 1))
      closeDrawer()
      notifyMsg({ type: 'success', text: t(okKey) })
    } catch (e) {
      const live = guardMode ? liveFromError(e) : null
      if (live) {
        const cand = candidates.find(x => x.id === id)
        setArchiveGuard({ candidateId: id, candidateName: cand?.name ?? '', mode: guardMode as 'archive' | 'trash', ...live })
        return
      }
      notifyMsg({ type: 'error', text: t(failKey) })
    }
  }

  // The actual API calls — also re-used once the guard modal resolves every blocker.
  const runArchive = (id: Id) =>
    lifecycleCall(() => api.post('/candidates/bulk/archive', { candidate_ids: [id] }), id, 'drawer.archived', 'drawer.archiveFailed', 'archive')
  const runMarkDeletion = (id: Id) =>
    lifecycleCall(() => api.post(`/candidates/${id}/mark-deletion`, {}), id, 'erase.markedForDeletion', 'erase.markFailed', 'trash')

  // Archive-guard modal state (§3B) — set when a pre-check or a 409 finds live blockers.
  const [archiveGuard, setArchiveGuard] = useState<ArchiveGuardTarget | null>(null)

  // Guarded entry point shared by archive + mark-deletion. The blockers check
  // runs FIRST: when it finds a live application/match the guard modal opens
  // and NOTHING else happens (no native confirm — the modal itself is the
  // confirmation). Only the clear case falls through to the plain confirm()
  // the UI used to show before calling onArchive/onMarkDeletion directly
  // ("proceed directly as today" — §3B ARCHIVE-GUARD spec point 2).
  const guardedLifecycle = async (id: Id, mode: 'archive' | 'trash', confirmKey: string, proceed: () => void) => {
    const cand = candidates.find(x => x.id === id)
    if (needsLiveCheck(cand)) {
      const blockers = await fetchLiveBlockers(id)
      if (blockers.applications.length || blockers.matches.length) {
        setArchiveGuard({ candidateId: id, candidateName: cand?.name ?? '', mode, ...blockers })
        return
      }
    }
    if (!window.confirm(t(confirmKey, { name: cand?.name ?? '' }))) return
    proceed()
  }

  // Archive ONE candidate (soft-delete → Gearchiveerd) via the bulk route with a single id.
  const archiveOne = (id: Id) => guardedLifecycle(id, 'archive', 'drawer.archiveConfirm', () => runArchive(id))
  // Restore an ARCHIVED candidate (undo the soft-delete) — no live-link risk, unguarded.
  // Success names the candidate + offers an "open" action (Danny 2026-07-13): the row
  // leaves the archived view, so the link is how you jump straight to the dossier.
  const restoreOne = async (id: Id) => {
    const cand = candidates.find(x => x.id === id)
    try {
      await api.post('/candidates/bulk/restore', { candidate_ids: [id] })
      setCandidates(p => p.filter(x => x.id !== id))
      setTotal(v => Math.max(0, v - 1))
      closeDrawer()
      notifyMsg({
        type: 'success',
        text: t('drawer.restoredNamed', { name: cand?.name ?? '' }),
        action: { label: t('drawer.openRestored'), onClick: () => selectCandidate({ id, name: cand?.name ?? '' } as Candidate) },
      })
    } catch {
      notifyMsg({ type: 'error', text: t('drawer.restoreFailed') })
    }
  }
  // Move an ARCHIVED candidate to the trash (ERASE-1 stage 2, reversible).
  const markDeletionOne = (id: Id) => guardedLifecycle(id, 'trash', 'erase.markConfirm', () => runMarkDeletion(id))

  // The modal's primary action: every blocker resolved → run the real archive/mark-deletion.
  const resolveArchiveGuard = () => {
    if (!archiveGuard) return
    const { candidateId, mode } = archiveGuard
    setArchiveGuard(null)
    if (mode === 'archive') runArchive(candidateId)
    else runMarkDeletion(candidateId)
  }

  // PERMANENT delete — opens the deletion-preview popup first; onConfirm force-deletes.
  const [eraseTarget, setEraseTarget] = useState<{ id: Id; name: string } | null>(null)
  const hardDeleteOne = (id: Id) => {
    const cand = candidates.find(x => x.id === id)
    setEraseTarget({ id, name: cand?.name ?? '' })
  }
  const confirmHardDelete = async () => {
    if (!eraseTarget) return
    const id = eraseTarget.id
    setEraseTarget(null)
    await lifecycleCall(() => api.delete(`/candidates/${id}/force`), id, 'drawer.hardDeleted', 'drawer.hardDeleteFailed')
  }

  return {
    selected, setSelected, detail, setDetail, drawerExpanded, setDrawerExpanded, drawerTab,
    selectCandidate, closeDrawer, patchCandidate,
    archiveOne, restoreOne, markDeletionOne,
    archiveGuard, setArchiveGuard, resolveArchiveGuard,
    eraseTarget, setEraseTarget, hardDeleteOne, confirmHardDelete,
  }
}
