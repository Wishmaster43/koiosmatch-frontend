/**
 * useCandidateMergeBulk — the bulk-merge (punt 4) cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): opens the
 * existing MergeCandidateModal for exactly the 2 selected rows, first
 * selected as `current`, second as the prefilled duplicate.
 */
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Bulk-merge entry (punt 4) — exactly 2 rows selected opens the existing
// MergeCandidateModal with the FIRST selected as `current` and the SECOND
// prefilled as the picked duplicate (mirrors the modal's own LiteCandidate shape).
export interface BulkMergeLite { id: Id; name: string; code?: string; email?: string }
export interface BulkMergeTarget { current: BulkMergeLite; other: BulkMergeLite }

interface UseCandidateMergeBulkParams {
  candidates: Candidate[]
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
}

export function useCandidateMergeBulk({ candidates, selectedIds, setSelectedIds }: UseCandidateMergeBulkParams) {
  // Bulk-merge modal state (punt 4) — set once exactly 2 candidates are selected
  // and the recruiter picks "Samenvoegen…" from the bulk-actions menu.
  const [bulkMergeTarget, setBulkMergeTarget] = useState<BulkMergeTarget | null>(null)

  // Prompt the merge modal for the two selected rows — CandidatesBulkBar only shows
  // the menu entry when selectedIds.size === 2, this is the defensive re-check.
  // [...selectedIds] preserves insertion (= click) order, so "first selected" is stable.
  const bulkMergePrompt = () => {
    const ids = [...selectedIds]
    if (ids.length !== 2) return
    const byId = new Map(candidates.map(c => [c.id, c]))
    const first = byId.get(ids[0]); const second = byId.get(ids[1])
    if (!first || !second) return
    const toLite = (c: Candidate): BulkMergeLite => ({ id: c.id, name: c.name, code: c.referenceNumber, email: c.email })
    setBulkMergeTarget({ current: toLite(first), other: toLite(second) })
  }
  // The modal's onMerged callback: close it and clear the selection (punt 4 —
  // the survivor reopens fresh via the page's own onMerged handler).
  const resolveBulkMerge = () => { setBulkMergeTarget(null); setSelectedIds(new Set()) }

  return { bulkMergeTarget, bulkMergePrompt, resolveBulkMerge }
}
