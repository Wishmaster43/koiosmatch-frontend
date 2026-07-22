/**
 * useTasksData — data layer for TasksPage (§0.3 size split, mirrors
 * useCandidatesData): loads the active task list, lazily loads archived tasks
 * while the archived toggle is on, and decorates every row with its lookup
 * label/colour (status/priority/type) so the list, donuts and KPIs share one
 * derivation. Plain useEffect fetching (no react-query here — matches the
 * page's existing pattern).
 */
import { useState, useEffect, useMemo } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { mapTask } from '../data/mapTask'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'
import type { Task, ApiTask } from '@/types/task'

interface UseTasksDataParams {
  showArchived: boolean
  statuses: TaskLookupItem[]
  priorities: TaskLookupItem[]
  types: TaskLookupItem[]
  statusMeta: (v?: string | null) => TaskLookupItem
  priorityMeta: (v?: string | null) => TaskLookupItem
  typeMeta: (v?: string | null) => TaskLookupItem
  doneStatusValues: string[]
}

export function useTasksData({
  showArchived, statuses, priorities, types, statusMeta, priorityMeta, typeMeta, doneStatusValues,
}: UseTasksDataParams) {
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
  // Dedicated signal for the archived (?archived=1) fetch, so a failure there
  // doesn't get swallowed as "no archived tasks" (audit finding: a 500 read as empty).
  const [archivedError, setArchivedError] = useState(false)

  // Resolve a task's status/type/priority label+colour from the lookups (de-hardcoded).
  const decorate = <T extends Task>(task: T): T => {
    const sm = statusMeta(String(task.statusKey)), pm = priorityMeta(String(task.priorityKey)), tm = typeMeta(String(task.typeKey))
    return { ...task,
      statusLabel: sm.label, statusColor: sm.color, statusIsDone: doneStatusValues.includes(String(task.statusKey)),
      priorityLabel: pm.label, priorityColor: pm.color,
      typeLabel: tm.label, typeColor: tm.color } as T
  }

  // Load tasks. A 404 means the endpoint isn't built yet → treat as empty; every
  // OTHER failure — including a network/timeout error with no response object at
  // all — is a real error (audit finding: the old `err?.response?.status` truthy
  // check silently dropped those into the empty state instead of the error state).
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get('/tasks', { signal: ctrl.signal })
      .then(res => setTasks(unwrapList<ApiTask>(res).rows.map(mapTask)))
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status !== 404) setError(true)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [])

  // All tasks decorated with their lookup labels/colours — the basis for KPIs/donuts/view.
  // Archived (soft-deleted) tasks, fetched lazily while the archived toggle is on
  // (server-side onlyTrashed via ?archived=1). TaskListResource now delivers
  // `archived`/`deleted_at` itself (W2 delivered, measured), so mapTask already sets
  // them correctly; the `archived: true` stamp below stays as a defensive no-op in
  // case a future BE regression drops the field on this specific fetch.
  useEffect(() => {
    if (!showArchived) return
    const ctrl = new AbortController()
    setArchivedError(false)
    api.get('/tasks', { params: { archived: 1 }, signal: ctrl.signal })
      .then(res => setArchivedTasks(unwrapList<ApiTask>(res).rows.map(mapTask).map(x => ({ ...x, archived: true }))))
      .catch(err => {
        if (isAbortError(err)) return
        setArchivedTasks([])
        // Same 404-is-empty exemption as the main fetch (same endpoint, different
        // params); every other failure (5xx, network) surfaces as a real error.
        if (err?.response?.status !== 404) setArchivedError(true)
      })
    return () => ctrl.abort()
  }, [showArchived])

  const all = useMemo(() => (showArchived ? archivedTasks : tasks).map(decorate), [tasks, archivedTasks, showArchived, statuses, priorities, types]) // eslint-disable-line react-hooks/exhaustive-deps

  // The view-relevant error: whichever fetch backs the CURRENT toggle state, so a
  // caller that only reads `error` (mirrors how TasksPage feeds it straight into
  // TasksTable) never shows a stale/wrong signal when the archived toggle flips.
  const visibleError = showArchived ? archivedError : error

  return { tasks, setTasks, archivedTasks, setArchivedTasks, loading, error: visibleError, archivedError, all, decorate }
}
