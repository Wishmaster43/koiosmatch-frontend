/**
 * useCandidateTagBulk — the tag add/remove cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): the union of
 * tags across the selection (for the "remove tag" option list) plus the
 * optimistic add/remove mutations. `notifyOutcome` is owned by the parent
 * hook (shared across every bulk cluster) and passed in so there is exactly
 * one implementation of it.
 */
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

interface UseCandidateTagBulkParams {
  candidates: Candidate[]
  setCandidates: Dispatch<SetStateAction<Candidate[]>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
  notifyOutcome: (successKey: string, params: Record<string, unknown>, updated: number, total: number) => void
}

export function useCandidateTagBulk({
  candidates, setCandidates, selectedIds, setSelectedIds, notify, t, notifyOutcome,
}: UseCandidateTagBulkParams) {
  // Union of tags across the selected candidates — the "remove tag" option list.
  const selectedTags = useMemo(() => {
    const set = new Set<string>()
    candidates.forEach(c => { if (selectedIds.has(c.id)) (c.tags ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [candidates, selectedIds])

  // Remove a tag from every selected candidate that has it (optimistic + reconcile).
  const bulkRemoveTag = (tag: string) => {
    const ids = [...selectedIds]
    if (!ids.length || !tag) return
    const changedIds = candidates.filter(c => ids.includes(c.id) && (c.tags ?? []).includes(tag)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tag) } : c))
    api.post('/candidates/bulk/tags/remove', { candidate_ids: ids, tag })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !updated.has(c.id)) ? { ...c, tags: [...(c.tags ?? []), tag] } : c))
        notifyOutcome('bulk.tagRemoved', { tag }, updated ? updated.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tag] } : c))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }

  // Add a tag to the selection (mirror of bulkRemoveTag).
  const bulkAddTag = (tag: string) => {
    const ids = [...selectedIds]
    const tg = tag.trim()
    if (!ids.length || !tg) return
    const changedIds = candidates.filter(c => ids.includes(c.id) && !(c.tags ?? []).includes(tg)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tg] } : c))
    api.post('/candidates/bulk/tags/add', { candidate_ids: ids, tag: tg })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !updated.has(c.id)) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tg) } : c))
        notifyOutcome('bulk.tagAdded', { tag: tg }, updated ? updated.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tg) } : c))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }

  return { selectedTags, bulkAddTag, bulkRemoveTag }
}
