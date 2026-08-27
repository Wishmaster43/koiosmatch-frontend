/**
 * useCandidateNoteBulk — the bulk-note cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): add the same
 * note to every selected candidate (no table column to patch, toast only).
 * `notifyOutcome` is owned by the parent hook (shared across every bulk
 * cluster) and passed in so there is exactly one implementation of it.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import type { Id } from '@/types/common'

interface UseCandidateNoteBulkParams {
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
  notifyOutcome: (successKey: string, params: Record<string, unknown>, updated: number, total: number) => void
}

export function useCandidateNoteBulk({ selectedIds, setSelectedIds, notify, t, notifyOutcome }: UseCandidateNoteBulkParams) {
  // Add the same note to every selected candidate (no table column → toast only).
  const bulkAddNote = (text: string) => {
    const ids = [...selectedIds]
    if (!ids.length || !text.trim()) return
    api.post('/candidates/bulk/notes', { candidate_ids: ids, text: text.trim() })
      .then((res) => {
        const n = Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length
        notifyOutcome('bulk.noteAdded', {}, n, ids.length)
      })
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }

  return { bulkAddNote }
}
