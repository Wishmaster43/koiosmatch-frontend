/**
 * useTaskFilters — all list-filter state for the tasks page (§0.3 size split,
 * mirrors useCandidateFilters/useApplicationFilters). Owns the panel dimensions
 * (status/priority/type/assignee), the KPI tile filter, the search text and the
 * archived toggle — plus the row predicate and clear-all. Client-side filtering.
 */
import { useState, useCallback } from 'react'
import { usePageMemory } from '@/lib/usePageMemory'
import { isTaskOverdue } from '../data/mapTask'

// Midnight today — the due-today boundary.
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

// The row fields the predicate reads (structural — the page's Task satisfies it).
interface FilterableTask {
  statusKey?: string | number
  priorityKey?: string | number
  typeKey?: string | number
  assignee?: { name?: string } | null
  statusIsDone?: boolean
  due?: string | null
  // TASK-DUE-TIME-1: read by isTaskOverdue for the time-aware 'overdue' KPI tile.
  dueTime?: string
  title?: string
  description?: string
}

export function useTaskFilters() {
  const [showArchived,     setShowArchived]     = usePageMemory('tasks.archived', false)
  const [query,            setQuery]            = usePageMemory('tasks.search', '')
  const [selectedStatus,   setSelectedStatus]   = usePageMemory<string[]>('tasks.status', [])
  const [selectedPriority, setSelectedPriority] = usePageMemory<string[]>('tasks.priority', [])
  const [selectedType,     setSelectedType]     = usePageMemory<string[]>('tasks.type', [])
  const [selectedAssignee, setSelectedAssignee] = useState<string[]>([])
  // KPI tile filter (one at a time): null | 'open' | 'overdue' | 'dueToday' | 'completed'.
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)

  // Anything narrowing the default view → the shared clear-button shows.
  const anyFilterActive = Boolean(query.trim() || showArchived || kpiFilter
    || selectedStatus.length || selectedPriority.length || selectedType.length || selectedAssignee.length)
  // Remount the (self-stateful) search input on clear so the visible text resets too.
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setShowArchived(false); setKpiFilter(null)
    setSelectedStatus([]); setSelectedPriority([]); setSelectedType([]); setSelectedAssignee([])
  }

  // One row predicate for table + board: panel filters + search + the KPI tile.
  const matchesFilters = useCallback((x: FilterableTask): boolean => {
    if (selectedStatus.length   && !selectedStatus.includes(String(x.statusKey)))      return false
    if (selectedPriority.length && !selectedPriority.includes(String(x.priorityKey)))  return false
    if (selectedType.length     && !selectedType.includes(String(x.typeKey)))          return false
    if (selectedAssignee.length && !selectedAssignee.includes(x.assignee?.name ?? '')) return false
    if (query.trim() && !`${x.title ?? ''} ${x.assignee?.name ?? ''} ${x.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) return false
    // KPI tile predicate (open/overdue/dueToday/completed). Overdue is time-aware
    // (TASK-DUE-TIME-1): a timed task counts from its due moment, not end of day.
    if (!kpiFilter) return true
    const due = x.due ? new Date(x.due) : null
    if (kpiFilter === 'completed') return Boolean(x.statusIsDone)
    if (kpiFilter === 'open')      return !x.statusIsDone
    if (kpiFilter === 'overdue')   return isTaskOverdue(x)
    if (kpiFilter === 'dueToday')  return !!(due && !x.statusIsDone && due.toDateString() === todayStart().toDateString())
    return true
  }, [selectedStatus, selectedPriority, selectedType, selectedAssignee, kpiFilter, query])

  return {
    showArchived, setShowArchived, query, setQuery,
    selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority,
    selectedType, setSelectedType, selectedAssignee, setSelectedAssignee,
    kpiFilter, setKpiFilter,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
  }
}
