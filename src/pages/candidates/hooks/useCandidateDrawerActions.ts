/**
 * useCandidateDrawerActions — drawer open/close state + the single-record
 * lifecycle mutations of the candidates page (§0.3 split from CandidatesPage):
 * select (light row → full record fetch, ARCH-3 aware), archive, restore,
 * mark-for-deletion (ERASE-1) and the hard-delete preview flow. The list
 * updates (remove row, total--) stay optimistic; the backend re-checks (§3B).
 */
import { useState, useRef } from 'react'
import api from '@/lib/api'
import { useCandidateRecord } from './useCandidateMutations'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

interface Args {
  candidates: Candidate[]
  setCandidates: (fn: (prev: Candidate[]) => Candidate[]) => void
  setTotal: (fn: (prev: number) => number) => void
  notifyMsg: (msg: { type: string; text: string }) => void
  t: (key: string) => string
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
  const lifecycleCall = async (call: () => Promise<unknown>, id: Id, okKey: string, failKey: string) => {
    try {
      await call()
      setCandidates(p => p.filter(x => x.id !== id))
      setTotal(v => Math.max(0, v - 1))
      closeDrawer()
      notifyMsg({ type: 'success', text: t(okKey) })
    } catch {
      notifyMsg({ type: 'error', text: t(failKey) })
    }
  }

  // Archive ONE candidate (soft-delete → Gearchiveerd) via the bulk route with a single id.
  const archiveOne = (id: Id) =>
    lifecycleCall(() => api.post('/candidates/bulk/archive', { candidate_ids: [id] }), id, 'drawer.archived', 'drawer.archiveFailed')
  // Restore an ARCHIVED candidate (undo the soft-delete).
  const restoreOne = (id: Id) =>
    lifecycleCall(() => api.post('/candidates/bulk/restore', { candidate_ids: [id] }), id, 'drawer.restored', 'drawer.restoreFailed')
  // Move an ARCHIVED candidate to the trash (ERASE-1 stage 2, reversible).
  const markDeletionOne = (id: Id) =>
    lifecycleCall(() => api.post(`/candidates/${id}/mark-deletion`, {}), id, 'erase.markedForDeletion', 'erase.markFailed')

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
    eraseTarget, setEraseTarget, hardDeleteOne, confirmHardDelete,
  }
}
