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
  // Status donut/filter counts, only non-empty buckets.
  const statusData   = useMemo(() => donutBy(statuses,   x => x.statusKey),   [all, statuses])   // eslint-disable-line react-hooks/exhaustive-deps
  // Same as statusData, keyed on priority instead.
  const priorityData = useMemo(() => donutBy(priorities, x => x.priorityKey), [all, priorities]) // eslint-disable-line react-hooks/exhaustive-deps
  const typeData     = useMemo(() => donutBy(types,      x => x.typeKey),     [all, types])      // eslint-disable-line react-hooks/exhaustive-deps

  // Assignee filter options (value/label/count) from the loaded rows.
  const assigneeOptions = useMemo(() => {
    const m: Record<string, { value: string; label: string; count: number }> = {}
    all.forEach(x => { const n = x.assignee?.name; if (n) (m[n] ??= { value: n, label: n, count: 0 }).count++ })
    return Object.values(m)
  }, [all])

  // TEAM-1: team filter options (value/label/count) — the internal department a
  // task waits at. Derived from the loaded rows, never a hardcoded list.
  const teamOptions = useMemo(() => {
    const m: Record<string, { value: string; label: string; count: number }> = {}
    all.forEach(x => { const n = x.team?.name; if (n) (m[n] ??= { value: n, label: n, count: 0 }).count++ })
    return Object.values(m)
  }, [all])

  // Linked-entity type filter options (candidate/vacancy/customer/…) — the raw
  // `type` token per link; the panel labels it via the shared links.* i18n keys.
  const linkTypeOptions = useMemo(() => {
    const m: Record<string, number> = {}
    all.forEach(x => (x.links ?? []).forEach(l => { if (l.type) m[l.type] = (m[l.type] ?? 0) + 1 }))
    return Object.entries(m).map(([value, count]) => ({ value, count }))
  }, [all])

  // Overdue is time-aware (TASK-DUE-TIME-1): a timed task counts from its due moment.
  const overdue  = all.filter(x => isTaskOverdue(x)).length
  const dueToday = all.filter(x => x.due && !x.statusIsDone && new Date(x.due).toDateString() === todayStart().toDateString()).length
  const openCount = all.filter(x => !x.statusIsDone).length
  const completedCount = all.filter(x => x.statusIsDone).length

  return { statusData, priorityData, typeData, assigneeOptions, teamOptions, linkTypeOptions, overdue, dueToday, openCount, completedCount }
}
