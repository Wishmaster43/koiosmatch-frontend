import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Plus } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { isAbortError } from '../../lib/mocks'
import { useRightPanel } from '../../context/RightPanelContext'
import { TaskLookupsProvider, useTaskLookups } from '../../context/TaskLookupsContext'
import InsightsRow from '../../components/insights/InsightsRow'
import TasksTable from './TasksTable'
import TasksBoard from './TasksBoard'
import TaskDrawer from './TaskDrawer'
import AddTaskModal from './AddTaskModal'
import { mapTask, mapTaskDetail } from './data/mapTask'

// Donut click → set exactly one filter value (or clear when clicking it again).
const pickOne = (set) => (d) => {
  const v = d?.key ?? d?.payload?.key ?? d?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}
// Right-panel multi-toggle for a filter dimension.
const tog = (set) => (v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

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
  const { t } = useTranslation('tasks')
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Statuses (= board columns), types and priorities come from the tenant lookup.
  const { statuses, types, priorities, statusMeta, typeMeta, priorityMeta, doneStatusValues } = useTaskLookups()

  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [view,     setView]     = useState('table')   // 'table' | 'board'
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [addOpen,  setAddOpen]  = useState(false)
  const [selectedStatus,   setSelectedStatus]   = useState([])
  const [selectedPriority, setSelectedPriority] = useState([])
  const [selectedType,     setSelectedType]     = useState([])
  const [selectedAssignee, setSelectedAssignee] = useState([])
  // KPI tile filter (one at a time): null | 'open' | 'overdue' | 'dueToday' | 'completed'.
  const [kpiFilter, setKpiFilter] = useState(null)

  // Board columns = the status lookup, normalised to { key, label, color }.
  const columns = useMemo(() => statuses.map(s => ({ key: s.value, label: s.label, color: s.color })), [statuses])

  // Resolve a task's status/type/priority label+colour from the lookups (de-hardcoded).
  const decorate = (task) => {
    const sm = statusMeta(task.statusKey), pm = priorityMeta(task.priorityKey), tm = typeMeta(task.typeKey)
    return { ...task,
      statusLabel: sm.label, statusColor: sm.color, statusIsDone: doneStatusValues.includes(task.statusKey),
      priorityLabel: pm.label, priorityColor: pm.color,
      typeLabel: tm.label, typeColor: tm.color }
  }

  // Load tasks. A 404 means the endpoint isn't built yet → treat as empty (not an
  // error); no mock fallback (geen dummy data — the seeder supplies real demo rows).
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get('/tasks', { signal: ctrl.signal })
      .then(res => setTasks(unwrapList(res).rows.map(mapTask)))
      .catch(err => {
        if (isAbortError(err)) return
        if (err?.response?.status && err.response.status !== 404) setError(true)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [])

  // All tasks decorated with their lookup labels/colours — the basis for KPIs,
  // donuts and the filtered view (KPIs/donuts count every task, not the page).
  const all = useMemo(() => tasks.map(decorate), [tasks, statuses, priorities, types]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Donut data (status / priority / type), each with counts ──
  const donutBy = (list, keyOf) => list
    .map(it => ({ name: it.label, key: it.value, color: it.color, value: all.filter(x => keyOf(x) === it.value).length }))
    .filter(d => d.value > 0)
  const statusData   = useMemo(() => donutBy(statuses,   x => x.statusKey),   [all, statuses])   // eslint-disable-line react-hooks/exhaustive-deps
  const priorityData = useMemo(() => donutBy(priorities, x => x.priorityKey), [all, priorities]) // eslint-disable-line react-hooks/exhaustive-deps
  const typeData     = useMemo(() => donutBy(types,      x => x.typeKey),     [all, types])      // eslint-disable-line react-hooks/exhaustive-deps

  // Assignee filter options (value/label/count) from the loaded rows.
  const assigneeOptions = useMemo(() => {
    const m = {}
    all.forEach(x => { const n = x.assignee?.name; if (n) (m[n] ??= { value: n, label: n, count: 0 }).count++ })
    return Object.values(m)
  }, [all])
  const asOptions = (data) => data.map(d => ({ value: d.key, label: d.name, count: d.value }))

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
  const matchesKpi = (x) => {
    if (!kpiFilter) return true
    const due = x.due ? new Date(x.due) : null
    if (kpiFilter === 'completed') return x.statusIsDone
    if (kpiFilter === 'open')      return !x.statusIsDone
    if (kpiFilter === 'overdue')   return due && !x.statusIsDone && due < todayStart()
    if (kpiFilter === 'dueToday')  return due && !x.statusIsDone && due.toDateString() === todayStart().toDateString()
    return true
  }

  // The visible rows: status/priority/type/assignee filters + the active KPI tile.
  const filtered = useMemo(() => all.filter(x => {
    if (selectedStatus.length   && !selectedStatus.includes(x.statusKey))       return false
    if (selectedPriority.length && !selectedPriority.includes(x.priorityKey))   return false
    if (selectedType.length     && !selectedType.includes(x.typeKey))           return false
    if (selectedAssignee.length && !selectedAssignee.includes(x.assignee?.name)) return false
    return matchesKpi(x)
  }), [all, selectedStatus, selectedPriority, selectedType, selectedAssignee, kpiFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open a task: show the light row immediately, then fetch the full detail. The
  // ref guards against out-of-order responses.
  const selectedIdRef = useRef(null)
  const selectTask = (task) => {
    if (selected?.id === task.id) { closeDrawer(); return }
    selectedIdRef.current = task.id
    setSelected(decorate(task)); setExpanded(false)
    api.get(`/tasks/${task.id}`)
      .then(r => { if (selectedIdRef.current === task.id) setSelected(decorate(mapTaskDetail(r.data?.data ?? r.data))) })
      .catch(() => {})
  }
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setExpanded(false) }

  // Edit one or more fields (drawer or kanban drag). `patch` is LOCAL-shaped
  // (statusKey/priorityKey/typeKey/due/assigneeId/assignee/description); we merge it
  // optimistically and translate to the API body (only the provided fields).
  const handleUpdate = (id, patch) => {
    setTasks(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch }) : prev))
    const body = {
      status: patch.statusKey, priority: patch.priorityKey, type: patch.typeKey,
      due_date: patch.due, description: patch.description, assignee_id: patch.assigneeId,
    }
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k])
    api.patch(`/tasks/${id}`, body).catch(() => {})
  }

  // Kanban move = a status-only update.
  const handleMove = (id, statusKey) => handleUpdate(id, { statusKey })

  // Add a comment from the drawer; append optimistically, then POST.
  const handleAddComment = (id, body) => {
    const optimistic = { id: `tmp-${Date.now()}`, author: '', authorInitials: '?', body, time: new Date().toISOString() }
    setSelected(prev => (prev && prev.id === id ? { ...prev, comments: [...(prev.comments ?? []), optimistic] } : prev))
    api.post(`/tasks/${id}/comments`, { body }).catch(() => {})
  }

  // Apply the authoritative task detail returned by the link endpoints to both the
  // open drawer and the matching list row (links + the table's first-link cell).
  const applyDetail = (id, res) => {
    const detail = decorate(mapTaskDetail(res?.data?.data ?? res?.data))
    setSelected(prev => (prev && prev.id === id ? detail : prev))
    setTasks(prev => prev.map(x => x.id === id ? { ...x, links: detail.links, linkLabel: detail.linkLabel } : x))
  }

  // Add a polymorphic link from the drawer; show it optimistically, then POST and
  // re-sync from the returned detail (which carries the resolved label).
  const handleAddLink = (id, link) => {
    setSelected(prev => (prev && prev.id === id ? { ...prev, links: [...(prev.links ?? []), link] } : prev))
    api.post(`/tasks/${id}/links`, { type: link.type, id: link.id }).then(r => applyDetail(id, r)).catch(() => {})
  }

  // Remove a link from the drawer; drop it optimistically, then DELETE and re-sync.
  const handleRemoveLink = (id, link) => {
    setSelected(prev => (prev && prev.id === id
      ? { ...prev, links: (prev.links ?? []).filter(l => !(l.type === link.type && String(l.id) === String(link.id))) }
      : prev))
    api.delete(`/tasks/${id}/links`, { data: { type: link.type, id: link.id } }).then(r => applyDetail(id, r)).catch(() => {})
  }

  // A new task created in the modal — prepend it to the list.
  const handleCreated = (raw) => { setTasks(prev => [mapTask(raw), ...prev]); setAddOpen(false) }

  // ── Insights strip: 3 donuts (filterable) + 4 KPI cards, equal footprint ──
  const insightDonuts = [
    { key: 'status',   title: t('insights.status'),   data: statusData,   onPick: pickOne(setSelectedStatus),   active: selectedStatus.length > 0,   onClear: () => setSelectedStatus([]) },
    { key: 'priority', title: t('insights.priority'), data: priorityData, onPick: pickOne(setSelectedPriority), active: selectedPriority.length > 0, onClear: () => setSelectedPriority([]) },
    { key: 'type',     title: t('insights.type'),     data: typeData,     onPick: pickOne(setSelectedType),     active: selectedType.length > 0,     onClear: () => setSelectedType([]) },
  ]
  const overdue  = all.filter(x => x.due && !x.statusIsDone && new Date(x.due) < todayStart()).length
  const dueToday = all.filter(x => x.due && !x.statusIsDone && new Date(x.due).toDateString() === todayStart().toDateString()).length
  const toggleKpi = (k) => setKpiFilter(p => p === k ? null : k)
  const insightKpis = [
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
          padding: '8px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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
          <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
            <TasksTable rows={filtered} loading={loading} error={error}
              selectedId={selected?.id} onSelect={selectTask} />
          </div>
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
