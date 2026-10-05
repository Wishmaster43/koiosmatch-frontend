/**
 * useTaskFilters — all list-filter state for the tasks page (§0.3 size split,
 * mirrors useCandidateFilters/useApplicationFilters). Owns the panel dimensions
 * (status/priority/type/assignee), the KPI tile filter, the search text and the
 * archived toggle — plus the row predicate and clear-all. The panel dimensions and
 * the KPI tile filter client-side; the search box is SERVER-SIDE in both of its
 * shapes — an exact `?ref=` lookup for a reference number, `?q=` for free text
 * (J013-SEARCH-1 J4: the backend matches every typed word across title, description
 * and the linked candidate/contact/customer/vacancy names, so "Lotte Bakker" finds
 * the task; the old client-side `.includes()` over the loaded page could not).
 */
import { useState, useCallback } from 'react'
import { usePageMemory } from '@/lib/usePageMemory'
import { isReferenceQuery } from '@/lib/referenceNumber'
import { isTaskOverdue } from '../data/mapTask'

// Midnight today — the due-today boundary.
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

// The row fields the predicate reads (structural — the page's Task satisfies it).
interface FilterableTask {
  statusKey?: string | number
  priorityKey?: string | number
  typeKey?: string | number
  assignee?: { name?: string } | null
  // TEAM-1: the internal department the task waits at — its own filter axis.
  team?: { name?: string } | null
  // TAAK-ROL-1: the role axis — a task queued for "whoever has this role".
  assigneeRole?: { name?: string } | null
  statusIsDone?: boolean
  due?: string | null
  // TASK-DUE-TIME-1: read by isTaskOverdue for the time-aware 'overdue' KPI tile.
  dueTime?: string
  archived?: boolean
  // Polymorphic link targets (candidate/vacancy/customer/…) — filtered by type.
  links?: { type?: string }[]
}

// A due-date range filter (inclusive both ends, either side optional).
export interface DueRangeFilter { from: string; to: string }

// Does a task's due date fall inside the selected range?
const inDueRange = (due: string | null | undefined, range: DueRangeFilter | null): boolean => {
  if (!range || (!range.from && !range.to)) return true
  if (!due) return false
  const d = new Date(due).getTime()
  if (range.from && d < new Date(range.from).getTime()) return false
  if (range.to && d > new Date(range.to).getTime()) return false
  return true
}

// All task list/board filter state (panel dimensions, search, KPI tile), plus the derived active flag and row predicate.
export function useTaskFilters() {
  const [showArchived,     setShowArchived]     = usePageMemory('tasks.archived', false)
  // TRASH-OVERAL-2: Prullenbak view (lifecycle pending_erase) — rides the same
  // ?archived=1 fetch, split client-side; mutually exclusive with the archived view.
  const [showTrash,        setShowTrash]        = usePageMemory('tasks.trash', false)
  const [query,            setQuery]            = usePageMemory('tasks.search', '')
  const [selectedStatus,   setSelectedStatus]   = usePageMemory<string[]>('tasks.status', [])
  const [selectedPriority, setSelectedPriority] = usePageMemory<string[]>('tasks.priority', [])
  const [selectedType,     setSelectedType]     = usePageMemory<string[]>('tasks.type', [])
  const [selectedAssignee, setSelectedAssignee] = useState<string[]>([])
  // TEAM-1: filter by the internal department a task waits at.
  const [selectedTeam,     setSelectedTeam]     = usePageMemory<string[]>('tasks.team', [])
  // Filter by the type of a task's linked entity (candidate/vacancy/customer/…).
  const [selectedLinkType, setSelectedLinkType] = usePageMemory<string[]>('tasks.linkType', [])
  // Deadline range (due-date window) — a single removable range, not multi-value.
  const [dueRange, setDueRange] = useState<DueRangeFilter | null>(null)
  // KPI tile filter (one at a time): null | 'open' | 'overdue' | 'dueToday' | 'completed'.
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)

  // NUMMER-1: a typed reference number (T-00042) flips the header search from the
  // client-side free-text filter to an exact server-side `?ref=` lookup (TaskQuery
  // returns early on `ref`, so it always finds that one task). Same shared detector
  // as candidates/customers/vacancies/matches — never a second regex.
  const refQuery = isReferenceQuery(query.trim()) ? query.trim() : null
  // J013-SEARCH-1 (J4): everything else typed is the server's free-text `?q=` term
  // (TaskQuery caps it at 255 characters, so the FE never sends a longer one and
  // never earns a 422 for it). Null while the box is blank or holds a reference number.
  const searchQuery = !refQuery && query.trim() ? query.trim().slice(0, 255) : null

  // Anything narrowing the default view → the shared clear-button shows.
  const anyFilterActive = Boolean(query.trim() || showArchived || showTrash || kpiFilter
    || selectedStatus.length || selectedPriority.length || selectedType.length || selectedAssignee.length
    || selectedTeam.length || selectedLinkType.length || dueRange)
  // Remount the (self-stateful) search input on clear so the visible text resets too.
  const [searchEpoch, setSearchEpoch] = useState(0)
  // Reset every filter dimension and bump the search epoch so the (self-stateful) search input remounts blank too.
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setShowArchived(false); setShowTrash(false); setKpiFilter(null)
    setSelectedStatus([]); setSelectedPriority([]); setSelectedType([]); setSelectedAssignee([])
    setSelectedTeam([]); setSelectedLinkType([]); setDueRange(null)
  }

  // One row predicate for table + board: panel filters + search + the KPI tile.
  const matchesFilters = useCallback((x: FilterableTask): boolean => {
    if (selectedStatus.length   && !selectedStatus.includes(String(x.statusKey)))      return false
    if (selectedPriority.length && !selectedPriority.includes(String(x.priorityKey)))  return false
    if (selectedType.length     && !selectedType.includes(String(x.typeKey)))          return false
    if (selectedAssignee.length && !selectedAssignee.includes(x.assignee?.name ?? '')) return false
    if (selectedTeam.length     && !selectedTeam.includes(x.team?.name ?? ''))         return false
    if (selectedLinkType.length && !(x.links ?? []).some(l => l.type && selectedLinkType.includes(l.type))) return false
    if (!inDueRange(x.due, dueRange)) return false
    // The search box never re-filters here: both the reference lookup (`?ref=`) and the
    // free-text search (`?q=`) already narrowed the fetch server-side, and a server match
    // on a linked name or the reference number lives in fields this predicate never reads.
    // KPI tile predicate (open/overdue/dueToday/completed). Overdue is time-aware
    // (TASK-DUE-TIME-1): a timed task counts from its due moment, not end of day.
    if (!kpiFilter) return true
    const due = x.due ? new Date(x.due) : null
    if (kpiFilter === 'completed') return Boolean(x.statusIsDone)
    if (kpiFilter === 'open')      return !x.statusIsDone
    if (kpiFilter === 'overdue')   return isTaskOverdue(x)
    if (kpiFilter === 'dueToday')  return !!(due && !x.statusIsDone && due.toDateString() === todayStart().toDateString())
    // KPI-RIJ-9-1: unassigned — mirrors useTaskOptions' unassigned count (open,
    // no assignee, no team AND no role).
    if (kpiFilter === 'unassigned') return !x.statusIsDone && !x.assignee?.name && !x.team?.name && !x.assigneeRole?.name
    return true
  }, [selectedStatus, selectedPriority, selectedType, selectedAssignee, selectedTeam, selectedLinkType, dueRange, kpiFilter])

  return {
    showArchived, setShowArchived, showTrash, setShowTrash, query, setQuery, refQuery, searchQuery,
    selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority,
    selectedType, setSelectedType, selectedAssignee, setSelectedAssignee,
    selectedTeam, setSelectedTeam, selectedLinkType, setSelectedLinkType,
    dueRange, setDueRange,
    kpiFilter, setKpiFilter,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
  }
}
