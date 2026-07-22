/**
 * useTaskOptions — donut/option/KPI derivations for TasksPage (§0.3 size
 * split): status/priority/type counts (feeding both the insights donuts and
 * the right-panel filter options), the assignee filter options, and the
 * open/overdue/due-today/completed KPI counts — all derived from the
 * decorated task list.
 */
import { useMemo } from 'react'
import { isTaskOverdue } from '../data/mapTask'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'
import type { Task } from '@/types/task'

export interface Aggregate { name: string; key: string; color?: string; value: number }

interface UseTaskOptionsParams {
  all: Task[]
  statuses: TaskLookupItem[]
  priorities: TaskLookupItem[]
  types: TaskLookupItem[]
}

// Midnight today — the due-today boundary.
const todayStart = () => new Date(new Date().toDateString())

export function useTaskOptions({ all, statuses, priorities, types }: UseTaskOptionsParams) {
  // ── Donut data (status / priority / type), each with counts ──
  const donutBy = (list: TaskLookupItem[], keyOf: (x: Task) => string | number): Aggregate[] => list
    .map(it => ({ name: it.label, key: it.value, color: it.color, value: all.filter(x => keyOf(x) === it.value).length }))
    .filter(d => d.value > 0)
  const statusData   = useMemo(() => donutBy(statuses,   x => x.statusKey),   [all, statuses])   // eslint-disable-line react-hooks/exhaustive-deps
  const priorityData = useMemo(() => donutBy(priorities, x => x.priorityKey), [all, priorities]) // eslint-disable-line react-hooks/exhaustive-deps
  const typeData     = useMemo(() => donutBy(types,      x => x.typeKey),     [all, types])      // eslint-disable-line react-hooks/exhaustive-deps

  // Assignee filter options (value/label/count) from the loaded rows.
  const assigneeOptions = useMemo(() => {
    const m: Record<string, { value: string; label: string; count: number }> = {}
    all.forEach(x => { const n = x.assignee?.name; if (n) (m[n] ??= { value: n, label: n, count: 0 }).count++ })
    return Object.values(m)
  }, [all])

  // Overdue is time-aware (TASK-DUE-TIME-1): a timed task counts from its due moment.
  const overdue  = all.filter(x => isTaskOverdue(x)).length
  const dueToday = all.filter(x => x.due && !x.statusIsDone && new Date(x.due).toDateString() === todayStart().toDateString()).length
  const openCount = all.filter(x => !x.statusIsDone).length
  const completedCount = all.filter(x => x.statusIsDone).length

  return { statusData, priorityData, typeData, assigneeOptions, overdue, dueToday, openCount, completedCount }
}
