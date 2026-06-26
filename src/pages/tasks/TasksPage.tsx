import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Plus } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { isAbortError } from '../../lib/mocks'
import { useRightPanel } from '../../context/RightPanelContext'
import { TaskLookupsProvider, useTaskLookups } from '../../context/TaskLookupsContext'
import type { TaskLookupItem } from '../../context/TaskLookupsContext'
import { useAuth } from '../../context/AuthContext'
import InsightsRow from '../../components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '../../components/insights/InsightsRow'
import TasksTable from './TasksTable'
import PaginationBar from '../../components/ui/PaginationBar'
import TasksBoard from './TasksBoard'
import type { BoardColumn } from './TasksBoard'
import TaskDrawer from './TaskDrawer'
import AddTaskModal from './AddTaskModal'
import { mapTask, mapTaskDetail } from './data/mapTask'
import type { Task, TaskDetail, ApiTask } from '../../types/task'
import type { Id } from '../../types/common'

interface Aggregate { name: string; key: string; color?: string; value: number }
interface NewLink { type: string; id: string; label: string }

// Donut click → set exactly one filter value (or clear when clicking it again).
const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}
// Right-panel multi-toggle for a filter dimension.
const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

// Midnight today — the boundary for overdue/due-today comparisons.
const todayStart = () => new Date(new Date().toDateString())

// Page wrapper: scopes the task lookups (statuses/types/priorities) to this screen.
export default function TasksPage() {
  return (
    <TaskLookupsProvider>
      <TasksPageInner />
    </TaskLookupsProvider>
  )
}

function TasksPageInner() {
  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined
  const { t } = useTranslation('tasks')
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Statuses (= board columns), types and priorities come from the tenant lookup.
  const { statuses, types, priorities, statusMeta, typeMeta, priorityMeta, doneStatusValues } = useTaskLookups()

  const [tasks,    setTasks]    = useState<Task[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [view,     setView]     = useState('table')   // 'table' | 'board'
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(() => user?.default_per_page ?? 50)
  const [selected, setSelected] = useState<TaskDetail | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [addOpen,  setAddOpen]  = useState(false)
  const [selectedStatus,   setSelectedStatus]   = useState<string[]>([])
  const [selectedPriority, setSelectedPriority] = useState<string[]>([])
  const [selectedType,     setSelectedType]     = useState<string[]>([])
  const [selectedAssignee, setSelectedAssignee] = useState<string[]>([])
  // KPI tile filter (one at a time): null | 'open' | 'overdue' | 'dueToday' | 'completed'.
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)

  // Board columns = the status lookup, normalised to { key, label, color }.
  const columns = useMemo<BoardColumn[]>(() => statuses.map(s => ({ key: s.value, label: s.label, color: s.color })), [statuses])

  // Resolve a task's status/type/priority label+colour from the lookups (de-hardcoded).
  const decorate = <T extends Task>(task: T): T => {
    const sm = statusMeta(String(task.statusKey)), pm = priorityMeta(String(task.priorityKey)), tm = typeMeta(String(task.typeKey))
    return { ...task,
      statusLabel: sm.label, statusColor: sm.color, statusIsDone: doneStatusValues.includes(String(task.statusKey)),
      priorityLabel: pm.label, priorityColor: pm.color,
      typeLabel: tm.label, typeColor: tm.color } as T
  }

  // Load tasks. A 404 means the endpoint isn't built yet → treat as empty.
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get('/tasks', { signal: ctrl.signal })
      .then(res => setTasks(unwrapList<ApiTask>(res).rows.map(mapTask)))
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status && err.response.status !== 404) setError(true)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [])

  // All tasks decorated with their lookup labels/colours — the basis for KPIs/donuts/view.
  const all = useMemo(() => tasks.map(decorate), [tasks, statuses, priorities, types]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const asOptions = (data: Aggregate[]) => data.map(d => ({ value: d.key, label: d.name, count: d.value }))

  // Register the right-panel filters (status + priority + type + assignee).
  const filterGroups = useMemo(() => [
    { key: 'status',   label: t('insights.status'),   selected: selectedStatus,   options: asOptions(statusData),   onToggle: tog(setSelectedStatus) },
    { key: 'priority', label: t('insights.priority'), selected: selectedPriority, options: asOptions(priorityData), onToggle: tog(setSelectedPriority) },
    { key: 'type',     label: t('insights.type'),     selected: selectedType,     options: asOptions(typeData),     onToggle: tog(setSelectedType) },
    { key: 'assignee', label: t('cols.assignee'),     selected: selectedAssignee, options: assigneeOptions,         onToggle: tog(setSelectedAssignee) },
  ], [t, selectedStatus, selectedPriority, selectedType, selectedAssignee, statusData, priorityData, typeData, assigneeOptions])

  useEffect(() => {
    registerFilters('tasks-page', filterGroups)
    return () => unregisterFilters('tasks-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // KPI tile predicate (open/overdue/dueToday/completed).
  const matchesKpi = (x: Task): boolean => {
    if (!kpiFilter) return true
    const due = x.due ? new Date(x.due) : null
    if (kpiFilter === 'completed') return x.statusIsDone
    if (kpiFilter === 'open')      return !x.statusIsDone
    if (kpiFilter === 'overdue')   return !!(due && !x.statusIsDone && due < todayStart())
    if (kpiFilter === 'dueToday')  return !!(due && !x.statusIsDone && due.toDateString() === todayStart().toDateString())
    return true
  }

  // Reset to the first page whenever a filter or KPI tile changes.
  useEffect(() => { setPage(1) }, [selectedStatus, selectedPriority, selectedType, selectedAssignee, kpiFilter])

  // The visible rows: status/priority/type/assignee filters + the active KPI tile.
  const filteredAll = useMemo(() => {
    return all.filter(x => {
      if (selectedStatus.length   && !selectedStatus.includes(String(x.statusKey)))       return false
      if (selectedPriority.length && !selectedPriority.includes(String(x.priorityKey)))   return false
      if (selectedType.length     && !selectedType.includes(String(x.typeKey)))           return false
      if (selectedAssignee.length && !selectedAssignee.includes(x.assignee?.name ?? ''))  return false
      return matchesKpi(x)
    })
  }, [all, selectedStatus, selectedPriority, selectedType, selectedAssignee, kpiFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const filtered  = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

  // Open a task: show the light row immediately, then fetch the full detail.
  const selectedIdRef = useRef<Id | null>(null)
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setExpanded(false) }
  const selectTask = (task: Task) => {
    if (selected?.id === task.id) { closeDrawer(); return }
    selectedIdRef.current = task.id ?? null
    setSelected(decorate(task) as TaskDetail); setExpanded(false)
    api.get(`/tasks/${task.id}`)
      .then(r => { if (selectedIdRef.current === task.id) setSelected(decorate(mapTaskDetail(r.data?.data ?? r.data))) })
      .catch(() => {})
  }

  // Edit one or more fields (drawer or kanban drag). `patch` is LOCAL-shaped.
  const handleUpdate = (id: Id | undefined, patch: Record<string, unknown>) => {
    setTasks(prev => prev.map(x => x.id === id ? ({ ...x, ...patch } as Task) : x))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as TaskDetail) : prev))
    const body: Record<string, unknown> = {
      status: patch.statusKey, priority: patch.priorityKey, type: patch.typeKey,
      due_date: patch.due, description: patch.description, assignee_id: patch.assigneeId,
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })
    api.patch(`/tasks/${id}`, body).catch(() => {})
  }

  // Kanban move = a status-only update.
  const handleMove = (id: Id, statusKey: string | number) => handleUpdate(id, { statusKey })

  // Add a comment from the drawer; append optimistically, then POST.
  const handleAddComment = (id: Id | undefined, body: string) => {
    const optimistic = { id: `tmp-${Date.now()}`, author: '', authorInitials: '?', body, time: new Date().toISOString() }
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, comments: [...(prev.comments ?? []), optimistic] } as TaskDetail) : prev))
    api.post(`/tasks/${id}/comments`, { body }).catch(() => {})
  }

  // Apply the authoritative task detail returned by the link endpoints.
  const applyDetail = (id: Id | undefined, res: { data?: unknown }) => {
    const r = res as { data?: { data?: unknown } }
    const detail = decorate(mapTaskDetail((r?.data?.data ?? r?.data) as ApiTask))
    setSelected(prev => (prev && prev.id === id ? detail : prev))
    setTasks(prev => prev.map(x => x.id === id ? { ...x, links: detail.links, linkLabel: detail.linkLabel } : x))
  }

  // Add a polymorphic link from the drawer; show it optimistically, then POST and re-sync.
  const handleAddLink = (id: Id | undefined, link: NewLink) => {
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, links: [...(prev.links ?? []), { type: link.type, id: link.id, label: link.label }] } as TaskDetail) : prev))
    api.post(`/tasks/${id}/links`, { type: link.type, id: link.id }).then(r => applyDetail(id, r)).catch(() => {})
  }

  // Remove a link from the drawer; drop it optimistically, then DELETE and re-sync.
  const handleRemoveLink = (id: Id | undefined, link: { type: string; id: Id | null }) => {
    setSelected(prev => (prev && prev.id === id
      ? ({ ...prev, links: (prev.links ?? []).filter(l => !(l.type === link.type && String(l.id) === String(link.id))) } as TaskDetail)
      : prev))
    api.delete(`/tasks/${id}/links`, { data: { type: link.type, id: link.id } }).then(r => applyDetail(id, r)).catch(() => {})
  }

  // A new task created in the modal — prepend it to the list.
  const handleCreated = (raw: unknown) => { setTasks(prev => [mapTask(raw as ApiTask), ...prev]); setAddOpen(false) }

  // ── Insights strip: 3 donuts (filterable) + 4 KPI cards, equal footprint ──
  const insightDonuts: DonutSpec[] = [
    { key: 'status',   title: t('insights.status'),   data: statusData,   onPick: pickOne(setSelectedStatus),   active: selectedStatus.length > 0,   onClear: () => setSelectedStatus([]) },
    { key: 'priority', title: t('insights.priority'), data: priorityData, onPick: pickOne(setSelectedPriority), active: selectedPriority.length > 0, onClear: () => setSelectedPriority([]) },
    { key: 'type',     title: t('insights.type'),     data: typeData,     onPick: pickOne(setSelectedType),     active: selectedType.length > 0,     onClear: () => setSelectedType([]) },
  ]
  const overdue  = all.filter(x => x.due && !x.statusIsDone && new Date(x.due) < todayStart()).length
  const dueToday = all.filter(x => x.due && !x.statusIsDone && new Date(x.due).toDateString() === todayStart().toDateString()).length
  const toggleKpi = (k: string) => setKpiFilter(p => p === k ? null : k)
  const insightKpis: KpiSpec[] = [
    { key: 'open',      label: t('kpi.open'),      value: all.filter(x => !x.statusIsDone).length, color: 'var(--color-primary)', onClick: () => toggleKpi('open'),      active: kpiFilter === 'open' },
    { key: 'overdue',   label: t('kpi.overdue'),   value: overdue,                                 color: 'var(--color-danger)',  onClick: () => toggleKpi('overdue'),   active: kpiFilter === 'overdue' },
    { key: 'dueToday',  label: t('kpi.dueToday'),  value: dueToday,                                color: 'var(--color-warning)', onClick: () => toggleKpi('dueToday'),  active: kpiFilter === 'dueToday' },
    { key: 'completed', label: t('kpi.completed'), value: all.filter(x => x.statusIsDone).length,  color: 'var(--color-success)', onClick: () => toggleKpi('completed'), active: kpiFilter === 'completed' },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Insights strip (donuts + KPIs) */}
        <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

        {/* Toolbar — add button + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
          padding: '8px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => setAddOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff' }}>
            <Plus size={15} /> {t('add')}
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setView('table')} title={t('view.table')} aria-label={t('view.table')}
              style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                background: view === 'table' ? 'var(--color-primary)' : 'var(--surface)',
                color: view === 'table' ? '#fff' : 'var(--text)' }}>
              <LayoutList size={16} />
            </button>
            <button onClick={() => setView('board')} title={t('view.board')} aria-label={t('view.board')}
              style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                background: view === 'board' ? 'var(--color-primary)' : 'var(--surface)',
                color: view === 'board' ? '#fff' : 'var(--text)' }}>
              <Kanban size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        {view === 'table' ? (
          <>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
              <TasksTable rows={filtered} loading={loading} error={error}
                selectedId={selected?.id} onSelect={selectTask} stickyHeader />
            </div>
            <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
              pageSize={pageSize} onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
          </>
        ) : (
          <TasksBoard rows={filtered} columns={columns} onMove={handleMove}
            selectedId={selected?.id} onSelect={selectTask} />
        )}
      </div>

      {/* Detail drawer */}
      <TaskDrawer
        key={selected?.id ?? 'none'}
        task={selected}
        onClose={closeDrawer}
        expanded={expanded}
        onToggleExpand={() => setExpanded(v => !v)}
        onUpdate={handleUpdate}
        onAddComment={handleAddComment}
        onAddLink={handleAddLink}
        onRemoveLink={handleRemoveLink}
      />

      {/* Add-activity modal */}
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
    </div>
  )
}
