/**
 * useTaskBulkActions — the bulk operations for TasksPage (§0.3 size split,
 * mirrors useCandidateBulkActions): row/all selection toggles, optimistic
 * field mutations (status/priority/assignee) and archive. Selection state
 * lives in the container and is passed in.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { initialsOf } from '@/lib/initials'
import type { Task, TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface UserLike { id: Id; name: string; avatar_color?: string | null }

interface Args {
  setTasks: Dispatch<SetStateAction<Task[]>>
  setSelected: Dispatch<SetStateAction<TaskDetail | null>>
  selected: TaskDetail | null
  closeDrawer: () => void
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  decorate: <T extends Task>(task: T) => T
  users: UserLike[]
  t: TFunction
}

export function useTaskBulkActions({
  setTasks, setSelected, selected, closeDrawer, selectedIds, setSelectedIds, decorate, users, t,
}: Args) {
  // ── Bulk selection + mutations ──
  const clearSelection = () => setSelectedIds(new Set())
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const n = new Set(prev); ids.forEach(i => { if (allSelected) n.delete(i); else n.add(i) }); return n
  })

  // Optimistic bulk field-set: apply the local patch + PATCH each; `all` re-derives labels.
  const runBulkPatch = async (localPatch: Record<string, unknown>, apiBody: Record<string, unknown>) => {
    const ids = [...selectedIds]; if (ids.length === 0) return
    const idSet = new Set(ids)
    setTasks(prev => prev.map(x => idSet.has(x.id as Id) ? ({ ...x, ...localPatch } as Task) : x))
    setSelected(prev => (prev && idSet.has(prev.id as Id) ? decorate({ ...prev, ...localPatch } as TaskDetail) : prev))
    clearSelection()
    const results = await Promise.allSettled(ids.map(id => api.patch(`/tasks/${id}`, apiBody)))
    if (results.some(r => r.status === 'rejected')) notifyError(t('common:actionFailed'))
    else notifySuccess(t('bulk.done', { count: ids.length }))
  }
  const bulkSetStatus   = (statusKey: string)   => runBulkPatch({ statusKey },   { status: statusKey })
  const bulkSetPriority = (priorityKey: string) => runBulkPatch({ priorityKey }, { priority: priorityKey })
  const bulkSetAssignee = (userId: string) => {
    const sel = users.find(u => String(u.id) === String(userId))
    const assignee = sel ? { name: sel.name, initials: initialsOf(sel.name), color: sel.avatar_color ?? null } : null
    runBulkPatch({ assigneeId: userId || null, assignee }, { assignee_id: userId || null })
  }
  // Optimistic bulk archive (reversible soft-delete) via the dedicated endpoint;
  // drop the rows + close the drawer if the open task was archived.
  const bulkArchive = async () => {
    const ids = [...selectedIds]; if (ids.length === 0) return
    const idSet = new Set(ids)
    setTasks(prev => prev.filter(x => !idSet.has(x.id as Id)))
    if (selected && idSet.has(selected.id as Id)) closeDrawer()
    clearSelection()
    try { await api.post('/tasks/bulk/archive', { task_ids: ids }); notifySuccess(t('bulk.done', { count: ids.length })) }
    catch { notifyError(t('common:actionFailed')) }
  }

  return { clearSelection, toggleRow, toggleAll, bulkSetStatus, bulkSetPriority, bulkSetAssignee, bulkArchive }
}
