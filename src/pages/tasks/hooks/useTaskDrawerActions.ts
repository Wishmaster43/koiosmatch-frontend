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
import { mapTaskDetail } from '../data/mapTask'
import type { Task, TaskDetail, ApiTask } from '@/types/task'
import type { Id } from '@/types/common'

interface NewLink { type: string; id: string; label: string }

interface Args {
  setTasks: Dispatch<SetStateAction<Task[]>>
  archivedTasks: Task[]
  setArchivedTasks: Dispatch<SetStateAction<Task[]>>
  decorate: <T extends Task>(task: T) => T
  t: TFunction
}

export function useTaskDrawerActions({ setTasks, archivedTasks, setArchivedTasks, decorate, t }: Args) {
  const [selected, setSelected] = useState<TaskDetail | null>(null)
  const [expanded, setExpanded] = useState(false)
  // Open a task: show the light row immediately, then fetch the full detail.
  const selectedIdRef = useRef<Id | null>(null)
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setExpanded(false) }
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
    setTasks(prev => prev.map(x => x.id === id ? ({ ...x, ...patch } as Task) : x))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as TaskDetail) : prev))
    const body: Record<string, unknown> = {
      status: patch.statusKey, priority: patch.priorityKey, type: patch.typeKey,
      // TASK-DUE-TIME-1: '' (cleared time input) persists as null, never as "".
      due_date: patch.due, due_time: patch.dueTime === undefined ? undefined : (patch.dueTime || null),
      description: patch.description, assignee_id: patch.assigneeId,
      tags: patch.tags, custom_fields: patch.customFields,
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })
    api.patch(`/tasks/${id}`, body).catch(() => notifyError(t('common:actionFailed')))
  }

  // Kanban move = a status-only update.
  const handleMove = (id: Id, statusKey: string | number) => handleUpdate(id, { statusKey })

  // Apply the authoritative task detail returned by the link endpoints.
  const applyDetail = (id: Id | undefined, res: { data: unknown }) => {
    const detail = decorate(mapTaskDetail(unwrap<ApiTask>(res)))
    setSelected(prev => (prev && prev.id === id ? detail : prev))
    setTasks(prev => prev.map(x => x.id === id ? { ...x, links: detail.links, linkLabel: detail.linkLabel } : x))
  }

  // Add a polymorphic link from the drawer; show it optimistically, then POST and re-sync.
  const handleAddLink = (id: Id | undefined, link: NewLink) => {
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, links: [...(prev.links ?? []), { type: link.type, id: link.id, label: link.label }] } as TaskDetail) : prev))
    api.post(`/tasks/${id}/links`, { type: link.type, id: link.id }).then(r => applyDetail(id, r)).catch(() => notifyError(t('common:actionFailed')))
  }

  // Remove a link from the drawer; drop it optimistically, then DELETE and re-sync.
  const handleRemoveLink = (id: Id | undefined, link: { type: string; id: Id | null }) => {
    setSelected(prev => (prev && prev.id === id
      ? ({ ...prev, links: (prev.links ?? []).filter(l => !(l.type === link.type && String(l.id) === String(link.id))) } as TaskDetail)
      : prev))
    api.delete(`/tasks/${id}/links`, { data: { type: link.type, id: link.id } }).then(r => applyDetail(id, r)).catch(() => notifyError(t('common:actionFailed')))
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

  return {
    selected, setSelected, expanded, setExpanded,
    closeDrawer, selectTask, handleUpdate, handleMove, handleAddLink, handleRemoveLink, restoreTask,
  }
}
