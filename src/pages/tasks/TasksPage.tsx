import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Archive, Plus } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { isAbortError } from '@/lib/mocks'
import { initialsOf } from '@/lib/initials'
import { useUsers } from '@/lib/queries'
import { useRightPanel } from '@/context/RightPanelContext'
import { TaskLookupsProvider, useTaskLookups } from '@/context/TaskLookupsContext'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'
import { useAuth } from '@/context/AuthContext'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import TasksTable from './TasksTable'
import TasksBulkBar from './TasksBulkBar'
import PaginationBar from '@/components/ui/PaginationBar'
import TasksBoard from './TasksBoard'
import type { BoardColumn } from './TasksBoard'
import TaskDrawer from './TaskDrawer'
import AddTaskModal from './AddTaskModal'
import { mapTask, mapTaskDetail } from './data/mapTask'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { usePageMemory } from '@/lib/usePageMemory'
import type { Task, TaskDetail, ApiTask } from '@/types/task'
import type { Id } from '@/types/common'

interface Aggregate { name: string; key: string; color?: string; value: number }
interface NewLink { type: string; id: string; label: string }
interface UserLike { id: Id; name: string; avatar_color?: string | null }

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
export default function TasksPage({ intent }: { intent?: unknown } = {}) {
  return (
    <TaskLookupsProvider>
      <TasksPageInner intent={intent} />
    </TaskLookupsProvider>
  )
}

function TasksPageInner({ intent }: { intent?: unknown }) {
  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined
  // Bulk archive (soft-delete, reversible → update-class gating; the backend re-checks).
  const canArchive = (auth as unknown as { hasPermission?: (p: string) => boolean })?.hasPermission?.('tasks.update') ?? false
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const { t } = useTranslation('tasks')
  // Scroll container for row virtualization (F-11): DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Statuses (= board columns), types and priorities come from the tenant lookup.
  const { statuses, types, priorities, statusMeta, typeMeta, priorityMeta, doneStatusValues } = useTaskLookups()

  const [tasks,    setTasks]    = useState<Task[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [view,     setView]     = usePageMemory('tasks.view', 'table')   // 'table' | 'board'
  const [showArchived, setShowArchived] = usePageMemory('tasks.archived', false)
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
  const [page,     setPage]     = usePageMemory('tasks.page', 1)
  const [pageSize, setPageSize] = useState(() => user?.default_per_page ?? 50)
  const [selected, setSelected] = useState<TaskDetail | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [addOpen,  setAddOpen]  = useState(false)
  const [query,    setQuery]    = usePageMemory('tasks.search', '')  // shared header search (client-side, R-5)
  // Bulk-selection (checkboxes) — id-set, cleared on filter/page change.
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  const [selectedStatus,   setSelectedStatus]   = usePageMemory<string[]>('tasks.status', [])
  const [selectedPriority, setSelectedPriority] = usePageMemory<string[]>('tasks.priority', [])
  const [selectedType,     setSelectedType]     = usePageMemory<string[]>('tasks.type', [])
  const [selectedAssignee, setSelectedAssignee] = useState<string[]>([])
  // KPI tile filter (one at a time): null | 'open' | 'overdue' | 'dueToday' | 'completed'.
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)

  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(query.trim() || showArchived || kpiFilter
    || selectedStatus.length || selectedPriority.length || selectedType.length || selectedAssignee.length)
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setShowArchived(false); setKpiFilter(null)
    setSelectedStatus([]); setSelectedPriority([]); setSelectedType([]); setSelectedAssignee([]); setPage(1)
  }

  // Seed filters from a navigation intent (dashboard KPI/chart click).
  useEffect(() => {
    if (!intent) return
    const i = intent as { kpi?: string; status?: string; priority?: string; type?: string; assignee?: string }
    if (i.kpi)      setKpiFilter(i.kpi)
    if (i.status)   setSelectedStatus([i.status])
    if (i.priority) setSelectedPriority([i.priority])
    if (i.type)     setSelectedType([i.type])
    if (i.assignee) setSelectedAssignee([i.assignee])
  }, [intent])

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
  // Archived (soft-deleted) tasks, fetched lazily while the archived toggle is on.
  useEffect(() => {
    if (!showArchived) return
    const ctrl = new AbortController()
    api.get('/tasks', { params: { archived: 1 }, signal: ctrl.signal })
      .then(res => setArchivedTasks(unwrapList<ApiTask>(res).rows.map(mapTask)))
      .catch(err => { if (!isAbortError(err)) setArchivedTasks([]) })
    return () => ctrl.abort()
  }, [showArchived])

  const all = useMemo(() => (showArchived ? archivedTasks : tasks).map(decorate), [tasks, archivedTasks, showArchived, statuses, priorities, types]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Reset to the first page + clear the selection whenever a filter/KPI tile changes.
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [selectedStatus, selectedPriority, selectedType, selectedAssignee, kpiFilter, showArchived, query])

  // The visible rows: status/priority/type/assignee filters + the active KPI tile.
  const filteredAll = useMemo(() => {
    return all.filter(x => {
      if (selectedStatus.length   && !selectedStatus.includes(String(x.statusKey)))       return false
      if (selectedPriority.length && !selectedPriority.includes(String(x.priorityKey)))   return false
      if (selectedType.length     && !selectedType.includes(String(x.typeKey)))           return false
      if (selectedAssignee.length && !selectedAssignee.includes(x.assignee?.name ?? ''))  return false
      if (query.trim() && !`${(x as { title?: string }).title ?? ''} ${x.assignee?.name ?? ''} ${(x as { description?: string }).description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) return false
      return matchesKpi(x)
    })
  }, [all, selectedStatus, selectedPriority, selectedType, selectedAssignee, kpiFilter, query]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // Open a task drawer when arriving via a cross-entity link ({ open: id }, candidate → task).
  useOpenFromIntent(intent, (id) => selectTask({ id } as Task))

  // Remember the open drawer across page switches; coming back reopens it (memory-only).
  const [rememberedId, setRememberedId] = usePageMemory<Id | null>('tasks.openId', null)
  useEffect(() => {{ setRememberedId(selected?.id ?? null) }}, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {{ if (rememberedId && !selected) (id => selectTask({ id } as Task))(rememberedId) }}, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Edit one or more fields (drawer or kanban drag). `patch` is LOCAL-shaped.
  const handleUpdate = (id: Id | undefined, patch: Record<string, unknown>) => {
    setTasks(prev => prev.map(x => x.id === id ? ({ ...x, ...patch } as Task) : x))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as TaskDetail) : prev))
    const body: Record<string, unknown> = {
      status: patch.statusKey, priority: patch.priorityKey, type: patch.typeKey,
      due_date: patch.due, description: patch.description, assignee_id: patch.assigneeId,
      tags: patch.tags,
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })
    api.patch(`/tasks/${id}`, body).catch(() => notifyError(t('common:actionFailed')))
  }

  // Kanban move = a status-only update.
  const handleMove = (id: Id, statusKey: string | number) => handleUpdate(id, { statusKey })

  // Add a comment from the drawer; append optimistically (with the current user as
  // author, like candidate notes), then POST.
  const handleAddComment = (id: Id | undefined, body: string) => {
    const u = auth?.user as { name?: string; firstname?: string; lastname?: string; email?: string } | null | undefined
    const authorName = (u?.name || [u?.firstname, u?.lastname].filter(Boolean).join(' ') || u?.email || '').trim()
    const optimistic = { id: `tmp-${Date.now()}`, author: authorName, authorInitials: initialsOf(authorName || '?'), body, time: new Date().toISOString() }
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, comments: [...(prev.comments ?? []), optimistic] } as TaskDetail) : prev))
    api.post(`/tasks/${id}/comments`, { body }).catch(() => notifyError(t('common:actionFailed')))
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
    api.post(`/tasks/${id}/links`, { type: link.type, id: link.id }).then(r => applyDetail(id, r)).catch(() => notifyError(t('common:actionFailed')))
  }

  // Remove a link from the drawer; drop it optimistically, then DELETE and re-sync.
  const handleRemoveLink = (id: Id | undefined, link: { type: string; id: Id | null }) => {
    setSelected(prev => (prev && prev.id === id
      ? ({ ...prev, links: (prev.links ?? []).filter(l => !(l.type === link.type && String(l.id) === String(link.id))) } as TaskDetail)
      : prev))
    api.delete(`/tasks/${id}/links`, { data: { type: link.type, id: link.id } }).then(r => applyDetail(id, r)).catch(() => notifyError(t('common:actionFailed')))
  }

  // A new task created in the modal — prepend it to the list.
  const handleCreated = (raw: unknown) => { setTasks(prev => [mapTask(raw as ApiTask), ...prev]); setAddOpen(false) }

  // ── Bulk selection + mutations ──
  const clearSelection = () => setSelectedIds(new Set())
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const n = new Set(prev); ids.forEach(i => { if (allSelected) n.delete(i); else n.add(i) }); return n
  })

  // Optimistic bulk field-set: apply the local patch + PATCH each; `all` re-derives labels.
  const runBulkPatch = async (localPatch: Record<string, unknown>, apiBody: Record<string, unknown>) => {
    const ids = [...selectedIds]; if (ids.length === 0) return
    const idSet = new Set(ids)
    setTasks(prev => prev.map(x => idSet.has(x.id as Id) ? ({ ...x, ...localPatch } as Task) : x))
    setSelected(prev => (prev && idSet.has(prev.id as Id) ? decorate({ ...prev, ...localPatch } as TaskDetail) : prev))
    clearSelection()
    const results = await Promise.allSettled(ids.map(id => api.patch(`/tasks/${id}`, apiBody)))
    if (results.some(r => r.status === 'rejected')) notifyError(t('common:actionFailed'))
    else notifySuccess(t('bulk.done', { count: ids.length }))
  }
  const bulkSetStatus   = (statusKey: string)   => runBulkPatch({ statusKey },   { status: statusKey })
  const bulkSetPriority = (priorityKey: string) => runBulkPatch({ priorityKey }, { priority: priorityKey })
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
    setTasks(prev => prev.filter(x => !idSet.has(x.id as Id)))
    if (selected && idSet.has(selected.id as Id)) closeDrawer()
    clearSelection()
    try { await api.post('/tasks/bulk/archive', { task_ids: ids }); notifySuccess(t('bulk.done', { count: ids.length })) }
    catch { notifyError(t('common:actionFailed')) }
  }

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

        {/* Toolbar — add on the LEFT, archived toggle + view toggle on the RIGHT (mirror Opportunities) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
          <button onClick={() => setAddOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff' }}>
            <Plus size={15} /> {t('add')}
          </button>
          <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={280} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Archived (soft-deleted) — shared quick-view toggle (§4). */}
            <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
              label={t('view.archived')} icon={Archive} />
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
        </div>

        {/* Bulk action bar — shown above the table when ≥1 row is selected. */}
        {view === 'table' && selectedIds.size > 0 && (
          <div style={{ padding: '8px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <TasksBulkBar count={selectedIds.size} onClear={clearSelection}
              onSetStatus={bulkSetStatus} onSetPriority={bulkSetPriority} onSetAssignee={bulkSetAssignee}
              onArchive={bulkArchive} canArchive={canArchive}
              statuses={statuses} priorities={priorities} users={users} />
          </div>
        )}

        {/* Content */}
        {view === 'table' ? (
          <>
            <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
              <TasksTable rows={filtered} loading={loading} error={error}
                selectedId={selected?.id} onSelect={selectTask} stickyHeader scrollParentRef={tableScrollRef}
                selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
            </div>
            <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
              pageSize={pageSize} onPageChange={p => { setPage(p); setSelectedIds(new Set()) }}
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
