/**
 * useCandidateUpdate — the drawer/header edit-flow: optimistic local patch,
 * PATCH via patchCandidate, precise revert on rejection, and adopting the
 * server-composed values on success (§0.3 split: CandidatesPage grew past
 * 400 lines). Pulled out as its own hook since it is a single, self-contained
 * responsibility with no other state of its own.
 */
import type { Dispatch, SetStateAction } from 'react'
import { mergePatch } from '@/lib/mergePatch'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

interface UseCandidateUpdateArgs {
  candidates: Candidate[]; setCandidates: Dispatch<SetStateAction<Candidate[]>>
  selected: Candidate | null; setSelected: Dispatch<SetStateAction<Candidate | null>>
  detail: Candidate | null; setDetail: Dispatch<SetStateAction<Candidate | null>>
  // STATUS-OVERRIDE-REVERT-1: resolves the patch's success (true) or rejection (false).
  patchCandidate: (id: Id, patch: Record<string, unknown>, onRevert: () => void, onServer: (c: Candidate) => void) => Promise<boolean>
}

export function useCandidateUpdate({ candidates, setCandidates, selected, setSelected, detail, setDetail, patchCandidate }: UseCandidateUpdateArgs) {
  // Header/profile edits in the drawer flow back here: optimistic locally, then PATCH.
  // `patch` is a dynamic UI edit (UI field names, some outside Candidate) → cast on merge.
  // STATUS-OVERRIDE-REVERT-1: returns patchCandidate's resolved boolean (true =
  // saved, false = reverted) so a caller-side local override can clear itself.
  const updateCandidate = (id: Id, patch: Record<string, unknown>): Promise<boolean> => {
    // OPTIMISTIC-REVERT-1 (audit 2026-07-27): snapshot ONLY the keys this patch
    // overwrites, in every slice that shows them, so a refused PATCH puts the old
    // values back instead of leaving a rejected edit on screen until the drawer is
    // reopened. Never the whole record — a parallel edit to another field must survive.
    const keys = Object.keys(patch)
    // Snapshots only the patched keys from a given record, so a rejected PATCH can revert precisely instead of rolling back the whole row.
    const pick = (c: Candidate | null | undefined) => {
      if (!c) return null
      const snap: Record<string, unknown> = {}
      keys.forEach(k => { snap[k] = (c as unknown as Record<string, unknown>)[k] })
      return snap
    }
    const beforeRow = pick(candidates.find(x => x.id === id))
    const beforeSelected = selected?.id === id ? pick(selected) : null
    const beforeDetail = detail?.id === id ? pick(detail) : null

    // ZZP-MERGE-1: deep-merge (never shallow-spread) so a patch touching only one
    // nested block (e.g. the ZZP tab's Facturatie save, `{ zzp: { iban, ... } }`)
    // keeps that object's other keys (Bedrijf/Adres) instead of wiping them locally.
    setCandidates(prev => prev.map(x => x.id === id ? mergePatch(x as unknown as Record<string, unknown>, patch) as unknown as Candidate : x))
    setSelected(prev => (prev && prev.id === id ? mergePatch(prev as unknown as Record<string, unknown>, patch) as unknown as Candidate : prev))
    setDetail(prev  => (prev && prev.id === id ? mergePatch(prev as unknown as Record<string, unknown>, patch) as unknown as Candidate : prev))

    return patchCandidate(id, patch, () => {
      if (beforeRow) setCandidates(prev => prev.map(x => x.id === id ? { ...x, ...beforeRow } as Candidate : x))
      if (beforeSelected) setSelected(prev => (prev && prev.id === id ? { ...prev, ...beforeSelected } as Candidate : prev))
      if (beforeDetail) setDetail(prev => (prev && prev.id === id ? { ...prev, ...beforeDetail } as Candidate : prev))
    }, serverCandidate => {
      // REFRESH-FIX-2: adopt the server-composed values for the patched keys only
      // (e.g. a name assembled server-side from first/last name), never the whole
      // record — a parallel edit to another field must survive. Guarded with
      // `k in server`: a patched key mapCandidate never produces (e.g. a UI-only
      // key from useCandidatePlacedMatch) is skipped instead of writing `undefined`.
      const server = serverCandidate as unknown as Record<string, unknown>
      const fromServer: Record<string, unknown> = {}
      keys.forEach(k => { if (k in server) fromServer[k] = server[k] })
      setCandidates(prev => prev.map(x => x.id === id ? { ...x, ...fromServer } as Candidate : x))
      setSelected(prev => (prev && prev.id === id ? { ...prev, ...fromServer } as Candidate : prev))
      setDetail(prev => (prev && prev.id === id ? { ...prev, ...fromServer } as Candidate : prev))
    })
  }

  return { updateCandidate }
}
