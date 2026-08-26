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
  // NUMMER-1: an exact reference-number lookup (T-00042). When set, both fetches
  // send `?ref=` and the server returns just that task (TaskQuery returns early on
  // ref, so no other filter can hide it). Null = the normal free-text page.
  refQuery?: string | null
  statuses: TaskLookupItem[]
  priorities: TaskLookupItem[]
  types: TaskLookupItem[]
  statusMeta: (v?: string | null) => TaskLookupItem
  priorityMeta: (v?: string | null) => TaskLookupItem
  typeMeta: (v?: string | null) => TaskLookupItem
  doneStatusValues: string[]
}

// TaskQuery::rules() caps per_page at `between:1,200`. Fixed 2026-08-05 (audit: "rows
// per page niet overal toegepast"): both fetches below used to call GET /tasks with NO
// per_page/page at all, so the controller's own default (25) silently capped the
// active list AND the archived list — and everything derived from them (donuts, KPIs,
// TasksPage's own client-side pageSize slicing) — to at most 25 tasks total (mirrors
// the "84 vs 25" bug useMatches.ts already fixed for matches). Now fetches the FULL
// set via a page loop, safety-capped at 5 pages (1000 rows), same scale as useMatches.
export const TASKS_MAX_PER_PAGE = 500
const TASKS_MAX_PAGES = 5

// Shared page-loop fetch for both the active and archived lists below — an exact
// ?ref= lookup (NUMMER-1) short-circuits to one request (mirrors useMatches.ts).
async function fetchAllTaskPages(baseParams: Record<string, unknown>, ref: string | null, signal: AbortSignal): Promise<ApiTask[]> {
  if (ref) {
    const res = await api.get('/tasks', { params: { ...baseParams, ref }, signal })
    return unwrapList<ApiTask>(res).rows
  }
  const all: ApiTask[] = []
  for (let pageNo = 1; pageNo <= TASKS_MAX_PAGES; pageNo++) {
    const res = await api.get('/tasks', { params: { ...baseParams, per_page: TASKS_MAX_PER_PAGE, page: pageNo }, signal })
    const { rows, lastPage } = unwrapList<ApiTask>(res)
    all.push(...rows)
    if (pageNo >= lastPage) break
  }
  return all
}

// Data layer for TasksPage (see the module doc above): loads the active list, lazily loads archived tasks while that toggle is on, and decorates every row with its lookup label/colour.
export function useTasksData({
  showArchived, refQuery = null, statuses, priorities, types, statusMeta, priorityMeta, typeMeta, doneStatusValues,
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
    // NUMMER-1: `?ref=` narrows the fetch to the one task carrying that number
    // (single request); otherwise the full set (page loop, see above).
    fetchAllTaskPages({}, refQuery, ctrl.signal)
      .then(rows => setTasks(rows.map(mapTask)))
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status !== 404) setError(true)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [refQuery])

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
    fetchAllTaskPages({ archived: 1 }, refQuery, ctrl.signal)
      .then(rows => setArchivedTasks(rows.map(mapTask).map(x => ({ ...x, archived: true }))))
      .catch(err => {
        if (isAbortError(err)) return
        setArchivedTasks([])
        // Same 404-is-empty exemption as the main fetch (same endpoint, different
        // params); every other failure (5xx, network) surfaces as a real error.
        if (err?.response?.status !== 404) setArchivedError(true)
      })
    return () => ctrl.abort()
  }, [showArchived, refQuery])

  const all = useMemo(() => (showArchived ? archivedTasks : tasks).map(decorate), [tasks, archivedTasks, showArchived, statuses, priorities, types]) // eslint-disable-line react-hooks/exhaustive-deps

  // The view-relevant error: whichever fetch backs the CURRENT toggle state, so a
  // caller that only reads `error` (mirrors how TasksPage feeds it straight into
  // TasksTable) never shows a stale/wrong signal when the archived toggle flips.
  const visibleError = showArchived ? archivedError : error

  return { tasks, setTasks, archivedTasks, setArchivedTasks, loading, error: visibleError, archivedError, all, decorate }
}
