/**
 * useTaskDrawerActions — drawer open/close state + the single-record mutations
 * of the tasks page (§0.3 split from TasksPage, mirrors useCandidateDrawerActions):
 * select (light row → full record fetch), field/kanban updates, polymorphic
 * link add/remove and archived-task restore. List updates stay optimistic;
 * the backend re-checks.
 */
import { useState, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { mergePatch } from '@/lib/mergePatch'
import { mapTaskDetail } from '../data/mapTask'
import { useTaskLookupIds } from './useTaskLookupIds'
import type { Task, TaskDetail, ApiTask } from '@/types/task'
import type { Id } from '@/types/common'

// The three lookup axes a drawer patch may carry, mapped to their uuid-FK map key.
const AXIS_OF: Record<string, 'type' | 'status' | 'priority'> = {
  typeKey: 'type', statusKey: 'status', priorityKey: 'priority',
}

interface NewLink { type: string; id: string; label: string }

interface Args {
  setTasks: Dispatch<SetStateAction<Task[]>>
  archivedTasks: Task[]
  setArchivedTasks: Dispatch<SetStateAction<Task[]>>
  decorate: <T extends Task>(task: T) => T
  t: TFunction
}

// Task drawer's open/close state plus its single-record mutations (select/patch/
// link/restore); see the module doc comment above for the full scope.
export function useTaskDrawerActions({ setTasks, archivedTasks, setArchivedTasks, decorate, t }: Args) {
  const [selected, setSelected] = useState<TaskDetail | null>(null)
  const [expanded, setExpanded] = useState(false)
  // TASKTYPE-ID-1 (measured): UpdateTaskRequest only validates the real uuid FK
  // (`status_id`/`priority_id`/`type_id`) — the tenant slug this drawer's header
  // pickers/DetailsTab carry (`status`/`priority`/`type`) is an undeclared key,
  // silently dropped by Laravel's `validated()` (200 OK, nothing changes). Shared
  // with AddTaskModal/useTaskBoardMove/useTaskBulkActions via the ONE slug→uuid
  // hook — see its header comment for the full story.
  const { maps: lookupIds } = useTaskLookupIds()
  // Open a task: show the light row immediately, then fetch the full detail.
  const selectedIdRef = useRef<Id | null>(null)
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setExpanded(false) }
  // Show the light row immediately, then replace it with the full-detail fetch; a
  // response for a task the user has since navigated away from is ignored (selectedIdRef).
  const selectTask = (task: Task) => {
    if (selected?.id === task.id) { closeDrawer(); return }
    selectedIdRef.current = task.id ?? null
    setSelected(decorate(task) as TaskDetail); setExpanded(false)
    // W2 delivered (measured: TaskController::show is now Task::withTrashed()->
    // findOrFail) — this fetch succeeds for an archived task too and replaces the
    // light row with the full detail; `archived` still pins to the row's own value
    // (same value either way) so a stale response can never flip it.
    api.get(`/tasks/${task.id}`)
      .then(r => { if (selectedIdRef.current === task.id) setSelected(decorate({ ...mapTaskDetail(unwrap(r)), archived: task.archived })) })
      .catch(() => {
        // Audit finding: a failed detail fetch used to fail silently, leaving the
        // drawer stuck on the light row with empty sections — notify so the user
        // knows the detail didn't load (only if this task is still the open one).
        if (selectedIdRef.current === task.id) notifyError(t('common:actionFailed'))
      })
  }

  // Edit one or more fields (drawer or kanban drag). `patch` is LOCAL-shaped.
  const handleUpdate = (id: Id | undefined, patch: Record<string, unknown>) => {
    // TASKTYPE-ID-1: resolve every lookup axis this patch touches to its real uuid
    // FK BEFORE any state changes. An axis whose slug has no matching row yet
    // (maps still loading, or a seed-only fallback row the server never created)
    // means there is nothing safe to send — firing the PATCH anyway would silently
    // no-op (200 OK, value unchanged). Abort the WHOLE update instead: no
    // optimistic write, no request, an honest toast — every picker visibly stays put.
    const resolvedIds: Partial<Record<'type' | 'status' | 'priority', string>> = {}
    for (const [patchKey, axis] of Object.entries(AXIS_OF)) {
      if (!(patchKey in patch)) continue
      const slug = patch[patchKey]
      const resolved = slug != null ? lookupIds[axis][String(slug)] : undefined
      if (!resolved) { notifyError(t('drawer.lookupNotReady')); return }
      resolvedIds[axis] = resolved
    }

    // Bug class fix: this used to `.catch(() => notifyError(...))` with no revert,
    // so a rejected PATCH left the new value on screen as if the server had saved
    // it. Snapshot ONLY the fields this patch overwrites (never the whole row, so a
    // parallel edit to some other field survives a revert), captured from the live
    // `prev` inside each setState updater since this hook only receives setTasks
    // (not the tasks array itself).
    const keys = Object.keys(patch)
    let beforeRow: Record<string, unknown> | undefined
    // ZZP-MERGE-1: deep-merge (never shallow-spread) so a patch touching only part
    // of a nested object (e.g. customFields) keeps that object's other keys instead
    // of wiping them locally (mirrors useCandidateRecord.updateCandidate).
    setTasks(prev => prev.map(x => {
      if (x.id !== id) return x
      beforeRow = {}
      keys.forEach(k => { (beforeRow as Record<string, unknown>)[k] = (x as unknown as Record<string, unknown>)[k] })
      return mergePatch(x as unknown as Record<string, unknown>, patch) as unknown as Task
    }))
    const beforeSelected = selected && selected.id === id
      ? keys.reduce((acc, k) => ({ ...acc, [k]: (selected as unknown as Record<string, unknown>)[k] }), {} as Record<string, unknown>)
      : undefined
    setSelected(prev => (prev && prev.id === id ? decorate(mergePatch(prev as unknown as Record<string, unknown>, patch) as unknown as TaskDetail) : prev))
    const body: Record<string, unknown> = {
      // T1: title is a plain PATCHable string field (UpdateTaskRequest 'title') —
      // was entirely missing from this mapping, so a title edit had nowhere to go.
      title: patch.title,
      // TASKTYPE-ID-1: the resolved uuid FK, never the bare tenant slug (see above).
      status_id: resolvedIds.status, priority_id: resolvedIds.priority, type_id: resolvedIds.type,
      // TASK-DUE-TIME-1: '' (cleared time input) persists as null, never as "".
      due_date: patch.due, due_time: patch.dueTime === undefined ? undefined : (patch.dueTime || null),
      description: patch.description, assignee_id: patch.assigneeId,
      // TEAM-1: the INTERNAL department FK (`assignee_team_id`) — nullable uuid,
      // cleared with an explicit null. Deliberately a SEPARATE key from
      // assignee_id: the two axes are non-exclusive (where the task waits vs. who
      // picked it up), and a patch that carries only one must never disturb the
      // other (measured 09-08: PATCH {assignee_id} keeps `assignee_team`).
      assignee_team_id: patch.teamId,
      // TASK-LOCATION-READ-1: branch (vestiging) FK — nullable uuid, cleared with
      // an explicit null (never dropped like an untouched/undefined key below).
      location_id: patch.locationId,
      tags: patch.tags, custom_fields: patch.customFields,
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })
    api.patch(`/tasks/${id}`, body).catch(err => {
      if (beforeRow) setTasks(prev => prev.map(x => x.id === id ? ({ ...x, ...beforeRow } as Task) : x))
      if (beforeSelected) setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...beforeSelected } as TaskDetail) : prev))
      notifyError(extractApiError(err, t('common:actionFailed')))
    })
  }

  // Kanban move = a status-only update.
  const handleMove = (id: Id, statusKey: string | number) => handleUpdate(id, { statusKey })

  // Apply the authoritative task detail returned by the link endpoints.
  const applyDetail = (id: Id | undefined, res: { data: unknown }) => {
    const detail = decorate(mapTaskDetail(unwrap<ApiTask>(res)))
    setSelected(prev => (prev && prev.id === id ? detail : prev))
    setTasks(prev => prev.map(x => x.id === id ? { ...x, links: detail.links, linkLabel: detail.linkLabel } : x))
  }

  // Add a polymorphic link from the drawer; show it optimistically, then POST and
  // re-sync. Bug class fix: a rejected POST used to only toast, leaving a link in
  // the drawer the backend never persisted — the user believed it was added.
  // Snapshot the pre-add `links` array (only that field) and restore it on failure.
  const handleAddLink = (id: Id | undefined, link: NewLink) => {
    const beforeLinks = selected && selected.id === id ? selected.links : undefined
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, links: [...(prev.links ?? []), { type: link.type, id: link.id, label: link.label }] } as TaskDetail) : prev))
    api.post(`/tasks/${id}/links`, { type: link.type, id: link.id })
      .then(r => applyDetail(id, r))
      .catch(err => {
        if (beforeLinks !== undefined) setSelected(prev => (prev && prev.id === id ? ({ ...prev, links: beforeLinks } as TaskDetail) : prev))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // Remove a link from the drawer; drop it optimistically, then DELETE and re-sync.
  // Same bug class + fix as handleAddLink above — a refused DELETE used to only
  // toast, leaving the link gone from the drawer while the backend still had it.
  const handleRemoveLink = (id: Id | undefined, link: { type: string; id: Id | null }) => {
    const beforeLinks = selected && selected.id === id ? selected.links : undefined
    setSelected(prev => (prev && prev.id === id
      ? ({ ...prev, links: (prev.links ?? []).filter(l => !(l.type === link.type && String(l.id) === String(link.id))) } as TaskDetail)
      : prev))
    api.delete(`/tasks/${id}/links`, { data: { type: link.type, id: link.id } })
      .then(r => applyDetail(id, r))
      .catch(err => {
        if (beforeLinks !== undefined) setSelected(prev => (prev && prev.id === id ? ({ ...prev, links: beforeLinks } as TaskDetail) : prev))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // Enkelstuks-sweep: un-archive ONE task via the per-id route (POST /tasks/{id}/restore,
  // BE D-3 — never the bulk route for one record). The row moves back to the active
  // list; the drawer closes (the row leaves the archived view, mirroring candidates).
  const restoreTask = (id: Id | undefined) => {
    if (id == null) return
    const row = archivedTasks.find(x => x.id === id)
    api.post(`/tasks/${id}/restore`)
      .then(() => {
        setArchivedTasks(prev => prev.filter(x => x.id !== id))
        if (row) setTasks(prev => [{ ...row, archived: false, archivedAt: null }, ...prev])
        closeDrawer()
        notifySuccess(t('drawer.archivedBanner.restored'))
      })
      .catch(() => notifyError(t('drawer.archivedBanner.restoreFailed')))
  }

  // SUBTASK-CREATE-1: local-ONLY tally bump after a subtask is created — no PATCH
  // (`subtask_progress` is a derived, read-only count, never a writable task
  // field), just increment the total the same list/detail rows already carry.
  const bumpSubtaskTotal = (id: Id | undefined) => {
    const bump = (p?: { done: number; total: number } | null) => ({ done: p?.done ?? 0, total: (p?.total ?? 0) + 1 })
    setTasks(prev => prev.map(x => x.id === id ? { ...x, subtaskProgress: bump((x as unknown as { subtaskProgress?: { done: number; total: number } | null }).subtaskProgress) } as Task : x))
    setSelected(prev => (prev && prev.id === id ? { ...prev, subtaskProgress: bump(prev.subtaskProgress) } : prev))
  }

  return {
    selected, setSelected, expanded, setExpanded,
    closeDrawer, selectTask, handleUpdate, handleMove, handleAddLink, handleRemoveLink, restoreTask, bumpSubtaskTotal,
  }
}
