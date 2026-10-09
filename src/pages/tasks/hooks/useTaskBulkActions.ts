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
import { useTaskLookupIds } from './useTaskLookupIds'
import { useBulkSelectionToggles } from '@/hooks/useBulkSelectionToggles'
import type { Task, TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface UserLike { id: Id; name: string; avatar_color?: string | null }

interface Args {
  setTasks: Dispatch<SetStateAction<Task[]>>
  tasks: Task[]
  setSelected: Dispatch<SetStateAction<TaskDetail | null>>
  selected: TaskDetail | null
  closeDrawer: () => void
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  decorate: <T extends Task>(task: T) => T
  users: UserLike[]
  t: TFunction
}

// Bulk-action handlers for the tasks table (status/priority/assignee/archive), each patching the wire FK while keeping the decorated row's local display slug (see BULK-WIRE-1 below).
export function useTaskBulkActions({
  tasks, setTasks, setSelected, selected, closeDrawer, selectedIds, setSelectedIds, decorate, users, t,
}: Args) {
  // BULK-WIRE-1: UpdateTaskRequest only validates status_id/priority_id (uuid,
  // exists:*) — sending the tenant slug under `status`/`priority` is a silent
  // no-op (200 OK, nothing changes; measured). TasksBulkBar's option values stay
  // slugs (used for the LOCAL optimistic patch below, e.g. statusMeta lookups),
  // so this resolves each slug to its real FK right before it hits the wire.
  const { maps: lookupIds } = useTaskLookupIds()

  // ── Bulk selection + mutations ──
  const clearSelection = () => setSelectedIds(new Set())
  const { toggleRow, toggleAll } = useBulkSelectionToggles(setSelectedIds)

  // Optimistic bulk field-set: apply the local patch, PATCH each, and revert exactly the rows the server refused (ONIX N-004).
  const runBulkPatch = async (localPatch: Record<string, unknown>, apiBody: Record<string, unknown>) => {
    const ids = [...selectedIds]; if (ids.length === 0) return
    const idSet = new Set(ids)
    // Snapshot the affected rows (and the open drawer record) before the optimistic write.
    const snapshot = new Map(tasks.filter(x => idSet.has(x.id as Id)).map(x => [x.id as Id, x]))
    const drawerSnapshot = selected && idSet.has(selected.id as Id) ? selected : null
    setTasks(prev => prev.map(x => idSet.has(x.id as Id) ? ({ ...x, ...localPatch } as Task) : x))
    setSelected(prev => (prev && idSet.has(prev.id as Id) ? decorate({ ...prev, ...localPatch } as TaskDetail) : prev))
    clearSelection()
    const results = await Promise.allSettled(ids.map(id => api.patch(`/tasks/${id}`, apiBody)))
    const failed = new Set(ids.filter((_, i) => results[i].status === 'rejected'))
    if (failed.size === 0) { notifySuccess(t('bulk.done', { count: ids.length })); return }
    // Revert every refused id to its pre-edit snapshot, drawer included.
    setTasks(prev => prev.map(x => (failed.has(x.id as Id) && snapshot.has(x.id as Id)) ? snapshot.get(x.id as Id)! : x))
    if (drawerSnapshot && failed.has(drawerSnapshot.id as Id)) {
      setSelected(prev => (prev && prev.id === drawerSnapshot.id ? drawerSnapshot : prev))
    }
    if (failed.size === ids.length) notifyError(t('bulk.allFailed', { count: ids.length }))
    else notifyError(t('bulk.partialFailed', { failed: failed.size, total: ids.length }))
  }
  // BULK-WIRE-1: local patch keeps the SLUG (`statusKey`/`priorityKey` — the decorated
  // row's own display fields); the wire body sends the resolved uuid FK. An
  // unresolved slug (lookup id map not loaded yet) means there is nothing safe to
  // send — mirrors useTaskDrawerActions.handleUpdate's single-record guard: abort
  // before any optimistic write, PATCH or success toast, rather than firing a body
  // that serialises away to `{}` (200 OK, nothing actually changed).
  const bulkSetStatus = (statusKey: string) => {
    const resolved = lookupIds.status[statusKey]
    if (!resolved) { notifyError(t('drawer.lookupNotReady')); return }
    runBulkPatch({ statusKey }, { status_id: resolved })
  }
  const bulkSetPriority = (priorityKey: string) => {
    const resolved = lookupIds.priority[priorityKey]
    if (!resolved) { notifyError(t('drawer.lookupNotReady')); return }
    runBulkPatch({ priorityKey }, { priority_id: resolved })
  }
  // Resolves the picked user to a display-ready assignee shape for the local optimistic patch, while the wire body sends the raw user id (or null to unassign).
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
    // Remember the removed rows with their positions so a refusal can put them back in order.
    const removed = tasks.map((x, index) => ({ x, index })).filter(e => idSet.has(e.x.id as Id))
    setTasks(prev => prev.filter(x => !idSet.has(x.id as Id)))
    if (selected && idSet.has(selected.id as Id)) closeDrawer()
    clearSelection()
    try { await api.post('/tasks/bulk/archive', { task_ids: ids }); notifySuccess(t('bulk.done', { count: ids.length })) }
    catch {
      setTasks(prev => {
        const next = [...prev]
        removed.forEach(({ x, index }) => next.splice(Math.min(index, next.length), 0, x))
        return next
      })
      notifyError(t('bulk.allFailed', { count: ids.length }))
    }
  }

  return { clearSelection, toggleRow, toggleAll, bulkSetStatus, bulkSetPriority, bulkSetAssignee, bulkArchive }
}
