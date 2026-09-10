/**
 * bulkEntityPost — the bulk "add note" and "archive" POST shape shared by the
 * customers and vacancies bulk-action hooks: same route pattern
 * (`/<entity>/bulk/notes` / `/<entity>/bulk/archive`), same request body shape
 * (`{ <idsKey>: ids, … }`) and the same optimistic-clear + toast dance — only
 * the entity name, the id-list body key and the item-list setter differ.
 */
import type { Dispatch, SetStateAction } from 'react'
import api from '@/lib/api'
import type { Id } from '@/types/common'

type Notify = (type: string, text: string) => void
type T = (key: string, options?: Record<string, unknown>) => string

interface EntityIdsArgs {
  // Literal unions: a mistyped route or ids key fails at compile time, not at runtime.
  entity: 'customers' | 'vacancies'
  idsKey: 'customer_ids' | 'vacancy_ids'
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: Notify
  t: T
}

// Bulk "add note" POST — returns a handler that posts the same note text to every
// selected id, then clears the selection (see file header for the shared shape).
export function bulkNotesPost({ entity, idsKey, selectedIds, setSelectedIds, notify, t }: EntityIdsArgs) {
  return (text: string) => {
    const ids = [...selectedIds]
    if (!ids.length || !text.trim()) return
    api.post(`/${entity}/bulk/notes`, { [idsKey]: ids, text: text.trim() })
      .then(res => notify('success', t('bulk.noteAdded', { count: Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length })))
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }
}

interface EntityArchiveArgs<Row extends { id?: Id }> extends EntityIdsArgs {
  setItems: Dispatch<SetStateAction<Row[]>>
  setTotal: Dispatch<SetStateAction<number>>
  confirm: (message: string, onConfirm: () => void, options?: { danger?: boolean }) => void
}

// Bulk archive POST — danger-confirms, then drops the archived rows from the list
// and adjusts the total (see file header for the shared shape).
export function bulkArchivePost<Row extends { id?: Id }>({
  entity, idsKey, selectedIds, setSelectedIds, setItems, setTotal, confirm, notify, t,
}: EntityArchiveArgs<Row>) {
  return () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    confirm(t('bulk.archiveConfirm', { count: ids.length }), () => {
      api.post(`/${entity}/bulk/archive`, { [idsKey]: ids })
        .then(res => {
          const archived: Id[] = Array.isArray(res.data?.archived) ? res.data.archived : ids
          const set = new Set(archived)
          setItems(prev => prev.filter(x => x.id == null || !set.has(x.id)))
          setTotal(tt => Math.max(0, tt - archived.length))
          notify('success', t('bulk.archived', { count: archived.length }))
        })
        .catch(() => notify('error', t('bulk.archiveError')))
      setSelectedIds(new Set())
    }, { danger: true })
  }
}
