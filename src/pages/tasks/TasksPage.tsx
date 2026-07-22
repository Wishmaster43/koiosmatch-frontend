import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Archive, Plus } from 'lucide-react'
import ViewModeToggle from '@/components/ui/ViewModeToggle'
import { useUsers } from '@/lib/queries'
import { useRightPanel } from '@/context/RightPanelContext'
import { TaskLookupsProvider, useTaskLookups } from '@/context/TaskLookupsContext'
import { useAuth } from '@/context/AuthContext'
import InsightsRow from '@/components/insights/InsightsRow'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import ViewSwitch from '@/components/ui/ViewSwitch'
import TasksTable from './TasksTable'
import TasksBulkBar from './TasksBulkBar'
import PaginationBar from '@/components/ui/PaginationBar'
import TasksBoard from './TasksBoard'
import type { BoardColumn } from './TasksBoard'
import TaskDrawer from './TaskDrawer'
import AddTaskModal from './AddTaskModal'
import { mapTask } from './data/mapTask'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useTaskFilters } from './hooks/useTaskFilters'
import { useTasksData } from './hooks/useTasksData'
import { useTaskOptions } from './hooks/useTaskOptions'
import { useTaskDrawerActions } from './hooks/useTaskDrawerActions'
import { useTaskBulkActions } from './hooks/useTaskBulkActions'
import { buildTaskFilterGroups } from './data/taskFilterGroups'
import { buildTaskInsights } from './data/taskInsights'
import { BTN_H } from '@/config/buttonMetrics'
import type { Task, ApiTask } from '@/types/task'
import type { Id } from '@/types/common'

interface UserLike { id: Id; name: string; avatar_color?: string | null }

// Right-panel multi-toggle for a filter dimension.
const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

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

  const [view,     setView]     = usePageMemory('tasks.view', 'table')   // 'table' | 'board'
  const [page,     setPage]     = usePageMemory('tasks.page', 1)
  const [pageSize, setPageSize] = useState(() => user?.default_per_page ?? 50)
  const [addOpen,  setAddOpen]  = useState(false)
  // Bulk-selection (checkboxes) — id-set, cleared on filter/page change.
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  // ALL filter state + the row predicate live in one hook (§0.3 size split).
  const {
    showArchived, setShowArchived, query, setQuery,
    selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority,
    selectedType, setSelectedType, selectedAssignee, setSelectedAssignee,
    kpiFilter, setKpiFilter,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
  } = useTaskFilters()

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

  // Data layer: load + decorate tasks/archived tasks (§0.3 split → hook).
  const { setTasks, archivedTasks, setArchivedTasks, loading, error, all, decorate } = useTasksData({
    showArchived, statuses, priorities, types, statusMeta, priorityMeta, typeMeta, doneStatusValues,
  })

  // Donut/filter/KPI derivations from the decorated list (§0.3 split → hook).
  const { statusData, priorityData, typeData, assigneeOptions, overdue, dueToday, openCount, completedCount } =
    useTaskOptions({ all, statuses, priorities, types })

  // Register the right-panel filters (status + priority + type + assignee) — pure builder (§0.3 split).
  const filterGroups = useMemo(() => buildTaskFilterGroups({
    t, tog,
    selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority,
    selectedType, setSelectedType, selectedAssignee, setSelectedAssignee,
    statusData, priorityData, typeData, assigneeOptions,
  }), [t, selectedStatus, selectedPriority, selectedType, selectedAssignee, statusData, priorityData, typeData, assigneeOptions])

  useEffect(() => {
    registerFilters('tasks-page', filterGroups)
    return () => unregisterFilters('tasks-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Reset to the first page + clear the selection whenever a filter/KPI tile changes.
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [selectedStatus, selectedPriority, selectedType, selectedAssignee, kpiFilter, showArchived, query])

  // The visible rows: the hook predicate (panel filters + search + KPI tile).
  const filteredAll = useMemo(() => all.filter(matchesFilters), [all, matchesFilters])

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const filtered  = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

  // Drawer open/close + single-record mutations (§0.3 split → hook).
  const {
    selected, setSelected, expanded, setExpanded,
    closeDrawer, selectTask, handleUpdate, handleMove, handleAddLink, handleRemoveLink, restoreTask,
  } = useTaskDrawerActions({ setTasks, archivedTasks, setArchivedTasks, decorate, t })

  // Open a task drawer when arriving via a cross-entity link ({ open: id }, candidate → task).
  useOpenFromIntent(intent, (id) => selectTask({ id } as Task))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same task (NAV-BACK-1; supersedes
  // the old memory-only remember).
  useDrawerUrl({ selectedId: selected?.id, openById: (id) => selectTask({ id } as Task), close: closeDrawer, intent })

  // A new task created in the modal — prepend it to the list.
  const handleCreated = (raw: unknown) => { setTasks(prev => [mapTask(raw as ApiTask), ...prev]); setAddOpen(false) }

  // Bulk selection + mutations (§0.3 split → hook).
  const { clearSelection, toggleRow, toggleAll, bulkSetStatus, bulkSetPriority, bulkSetAssignee, bulkArchive } =
    useTaskBulkActions({ setTasks, setSelected, selected, closeDrawer, selectedIds, setSelectedIds, decorate, users, t })

  // ── Insights strip: 3 donuts (filterable) + 4 KPI cards, equal footprint — pure builder (§0.3 split) ──
  const toggleKpi = (k: string) => setKpiFilter(p => p === k ? null : k)
  const { donuts: insightDonuts, kpis: insightKpis } = buildTaskInsights({
    t, statusData, priorityData, typeData,
    selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority, selectedType, setSelectedType,
    kpiFilter, toggleKpi, openCount, overdue, dueToday, completedCount,
  })

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Insights strip (donuts + KPIs) */}
        <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

        {/* Toolbar — add on the LEFT, archived toggle + view toggle on the RIGHT (mirror Opportunities) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
          {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
          <button onClick={() => setAddOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff' }}>
            <Plus size={15} /> {t('add')}
          </button>
          <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={280} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Archived (soft-deleted) — shared quick-view toggle (§4). */}
            <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
              label={t('view.archived')} color="var(--color-archive)" icon={Archive} />
            {/* Table/board switcher — shared soft-tint component (§4), never a solid fill. */}
            <ViewModeToggle value={view} onChange={setView} options={[
              { id: 'table', icon: LayoutList, label: t('view.table') },
              { id: 'board', icon: Kanban, label: t('view.board') },
            ]} />
          </div>
        </div>

        {/* Table ⇄ board — ViewSwitch keeps both mounted (display toggle, not
            unmount) so the table's virtualizer never remeasures 0 on returning
            from the board (§ViewSwitch, mirrors candidates/customers). */}
        <ViewSwitch active={view} views={[
          {
            id: 'table',
            render: () => (
              <>
                {/* Bulk action bar — shown above the table when ≥1 row is selected. */}
                {selectedIds.size > 0 && (
                  <div style={{ padding: '8px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <TasksBulkBar count={selectedIds.size} onClear={clearSelection}
                      onSetStatus={bulkSetStatus} onSetPriority={bulkSetPriority} onSetAssignee={bulkSetAssignee}
                      onArchive={bulkArchive} canArchive={canArchive}
                      statuses={statuses} priorities={priorities} users={users} />
                  </div>
                )}
                <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
                  <TasksTable rows={filtered} loading={loading} error={error}
                    selectedId={selected?.id} onSelect={selectTask} stickyHeader scrollParentRef={tableScrollRef}
                    selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
                </div>
                <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
                  pageSize={pageSize} onPageChange={p => { setPage(p); setSelectedIds(new Set()) }}
                  onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
              </>
            ),
          },
          {
            id: 'board',
            render: () => (
              <TasksBoard rows={filtered} columns={columns} onMove={handleMove}
                selectedId={selected?.id} onSelect={selectTask} />
            ),
          },
        ]} />
      </div>

      {/* Detail drawer */}
      <TaskDrawer
        key={selected?.id ?? 'none'}
        task={selected}
        onClose={closeDrawer}
        expanded={expanded}
        onToggleExpand={() => setExpanded(v => !v)}
        onUpdate={handleUpdate}
        onAddLink={handleAddLink}
        onRemoveLink={handleRemoveLink}
        // Restore is update-class (reversible, BE gates tasks.update) — same signal as archive.
        onRestore={canArchive ? restoreTask : undefined}
      />

      {/* Add-activity modal */}
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
    </div>
  )
}
