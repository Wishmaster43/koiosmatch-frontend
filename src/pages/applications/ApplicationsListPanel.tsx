/**
 * ApplicationsListPanel — the "table area" of ApplicationsPage: insights row,
 * toolbar (add + search + quick-view toggles + view switcher) and the
 * table/board content with pagination. Pulled out of ApplicationsPage (§0.3
 * size split, mirrors CandidatesListPanel) — a thin, dumb rendering cluster;
 * all state/mutations still live in the hooks ApplicationsPage owns and
 * arrive here as plain props/callbacks, so behaviour is unchanged.
 */
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Plus, Archive, MessageCircle, Pause, Users, X } from 'lucide-react'
import ViewModeToggle from '@/components/ui/ViewModeToggle'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import ApplicationsTable from './ApplicationsTable'
import ApplicationsBoard from './ApplicationsBoard'
import type { BoardPhase } from './ApplicationsBoard'
import ApplicationsBulkBar from './ApplicationsBulkBar'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import Button from '@/components/ui/Button'
import { BTN_H } from '@/config/buttonMetrics'
import { tintBg, tintBorder } from '@/lib/tint'
// W31 remnant: the paused quick-view wears the SAME colour as the paused chip.
import { interviewCategoryColor } from './data/applicationsShared'
import type { Application } from '@/types/application'
import type { Id, LookupOption } from '@/types/common'
import type { AppSort } from './hooks/useApplicationsData'

interface ApplicationsListPanelProps {
  // Insights row
  insightDonuts: DonutSpec[]
  insightKpis: KpiSpec[]
  // Data-honesty notice (STATS-OOM-1 / S-board-1 / VESTIGING-2) — raw inputs so
  // the ternary that picks the right message stays next to its own comment below.
  statsFailed: boolean
  wideIsPartial: boolean
  branchFilterExcludesAll: boolean
  // Toolbar
  onAddOpen: () => void
  // hidden without the create permission (OPENERS-HIDE-1, Danny 05-09).
  canCreate: boolean
  searchEpoch: number
  onSearch: (v: string) => void
  anyFilterActive: boolean
  onClearFilters: () => void
  candidateScopeCount: number
  onClearCandidateScope: () => void
  showArchived: boolean
  onToggleArchived: () => void
  interviewBusy: boolean
  onToggleInterviewBusy: () => void
  interviewPaused: boolean
  onToggleInterviewPaused: () => void
  // Loosely typed (mirrors the page's usePageMemory('apps.view', 'table') — no
  // explicit generic there, so the state itself is a plain string) — ViewModeToggle
  // is itself generic (T extends string = string) and infers its concrete union
  // from its own `options` prop, so this stays a plain string on the wire.
  view: string
  onViewChange: (v: string) => void
  // Bulk bar (table view only)
  selectedCount: number
  onClearSelection: () => void
  onBulkSetPhase: (phaseKey: string) => void
  onBulkDetach: (reason: string) => void
  canManage: boolean
  funnelPhases: LookupOption[]
  // Table
  tableScrollRef: RefObject<HTMLDivElement | null>
  tableRows: Application[]
  loading: boolean
  error: unknown
  selectedId?: Id
  onSelect: (row: Application, tab?: string) => void
  selectedIds: Set<Id>
  onToggleRow: (id: Id) => void
  onToggleAll: (ids: Id[], allSelected: boolean) => void
  selectionBusy?: boolean
  sort: AppSort | null
  onSortChange: (sort: AppSort) => void
  // Pagination
  page: number
  lastPage: number
  total: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  // Board
  boardRows: Application[]
  boardPhases: BoardPhase[]
  onMove: (id: Id, phaseKey: string) => void
  wideLoading: boolean
  wideError: unknown
}

// Insights row, toolbar and table/board view for the applications page; purely dumb rendering, all state and mutations arrive as props from ApplicationsPage (see file header).
export default function ApplicationsListPanel({
  insightDonuts, insightKpis, statsFailed, wideIsPartial, branchFilterExcludesAll,
  onAddOpen, canCreate, searchEpoch, onSearch, anyFilterActive, onClearFilters,
  candidateScopeCount, onClearCandidateScope,
  showArchived, onToggleArchived, interviewBusy, onToggleInterviewBusy, interviewPaused, onToggleInterviewPaused,
  view, onViewChange,
  selectedCount, onClearSelection, onBulkSetPhase, onBulkDetach, canManage, funnelPhases,
  tableScrollRef, tableRows, loading, error, selectedId, onSelect, selectedIds, onToggleRow, onToggleAll, selectionBusy,
  sort, onSortChange, page, lastPage, total, pageSize, pageSizeOptions, onPageChange, onPageSizeChange,
  boardRows, boardPhases, onMove, wideLoading, wideError,
}: ApplicationsListPanelProps) {
  const { t } = useTranslation('applications')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

      {/* Insights strip (donuts + KPIs) */}
      <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')}
        // Data honesty (STATS-OOM-1, mirrors CandidatesPage): owner/source/avgScore/
        // aiTasks are real server-wide totals now (W27) — the notice only fires when
        // `/applications/stats` itself failed AND the wideRows fallback it's using
        // instead is itself an incomplete sample (statsFailed && wideIsPartial).
        // VESTIGING-2: an explicit branch filter EXCLUDES applications with no
        // branch yet — a resulting empty list must say so, not read as "nothing here".
        // S-board-1: the board view's columns are built straight from `wideRows`
        // (no stats-backed bucket source there), so a capped sample must be
        // disclosed regardless of whether /applications/stats itself is healthy —
        // stats health only matters for the table view's fallback path above.
        notice={(statsFailed && wideIsPartial) ? t('insights.pageScopeNotice')
          : (view === 'board' && wideIsPartial) ? t('insights.pageScopeNotice')
          : (branchFilterExcludesAll ? t('common:filters.branchExcludesUnassigned') : undefined)} />

      {/* Tab bar — add + search + quick-views + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
        padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
              Hidden without the create permission (OPENERS-HIDE-1, Danny 05-09). */}
          {canCreate && (
            <Button variant="primary" size="md" onClick={onAddOpen}>
              <Plus size={14} /> {t('add.button')}
            </Button>
          )}
          {/* Shared header search (T10) — debounced, client-side text filter. */}
          <HeaderSearch key={searchEpoch} onSearch={onSearch} placeholder={t('page.searchPlaceholder')} width={300} />
          <ClearFiltersButton active={anyFilterActive} onClear={onClearFilters} />
          {/* 11.1: the candidates-bulk deep-link scope — a soft chip (§4 convention)
              showing the selection-based filter is active, clearable on its own
              (independent of the general clear-filters button above). */}
          {candidateScopeCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 10px', borderRadius: 7,
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tintBg/tintBorder ARE the canonical §4 tint helpers; the primary token here is only their argument, not a hand-painted fill
              background: tintBg('var(--color-primary)'),
              border: tintBorder('var(--color-primary)'),
              color: 'var(--color-primary-text)', fontSize: 12, fontWeight: 500 }}>
              <Users size={13} />
              {t('page.scopedBySelection', { count: candidateScopeCount })}
              <Button variant="ghostAccent" iconOnly size="sm" onClick={onClearCandidateScope}
                aria-label={t('page.clearScope')}>
                <X size={13} />
              </Button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* No status bucket tabs here (Danny 14-08, "moet een donut worden!!"):
            the active/matched/rejected dimension moved to the insights-row
            donut and the right filter panel's bucket group — only the toolbar
            control was removed, the `bucket` state itself still lives on the page. */}
        {/* Archived (detached) view — shared quick-view toggle (§4). */}
        <QuickViewToggle active={showArchived} onToggle={onToggleArchived}
          label={t('archived.toggle')} color="var(--color-archive)" icon={Archive} />
        {/* INTERVIEW-PHASE-1 quick-views onto the universal category filter — the
            shared toggle (§4), never hand-rolled. Mutual exclusivity is enforced
            by the page's click handlers (each toggle clears its sibling). */}
        <QuickViewToggle active={interviewBusy} onToggle={onToggleInterviewBusy}
          label={t('interview.filterBusy')} color="var(--color-info)" icon={MessageCircle} />
        {/* W27: "Paused" — a real server-side interview_status=paused quick-view. */}
        <QuickViewToggle active={interviewPaused} onToggle={onToggleInterviewPaused}
          label={t('interview.category.paused')} color={interviewCategoryColor('paused')} icon={Pause} />
        {/* Table/board switcher — shared soft-tint component (§4), never a solid fill. */}
        <ViewModeToggle value={view} onChange={onViewChange} options={[
          { id: 'table', icon: LayoutList, label: t('view.table') },
          { id: 'board', icon: Kanban, label: t('view.board') },
        ]} />
        </div>
      </div>

      {/* Content — BOTH views stay mounted, the inactive one is display:none
          (APPS-VIRT-1): unmounting the table remounted the scroll container and
          @tanstack/react-virtual measured 0 height → 0 rows after board→table.
          Hiding instead keeps the virtualizer's measurements AND the board's
          drag state alive across toggles. */}
      <div style={{ display: view === 'table' ? 'contents' : 'none' }}>
          {/* Bulk action bar — shown above the table when ≥1 row is selected. */}
          {selectedCount > 0 && (
            <div style={{ padding: '8px 24px 0' }}>
              <ApplicationsBulkBar count={selectedCount} onClear={onClearSelection}
                onSetPhase={onBulkSetPhase} onDetach={onBulkDetach} canManage={canManage} phases={funnelPhases} />
            </div>
          )}
          {/* Virtualized (F-7): tableScrollRef is the scroll container DataTable measures against. */}
          <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
            <ApplicationsTable rows={tableRows} loading={loading} error={error}
              selectedId={selectedId} onSelect={onSelect} stickyHeader
              selectable selectedIds={selectedIds} onToggleRow={onToggleRow} onToggleAll={onToggleAll}
              selectionBusy={selectionBusy}
              scrollParentRef={tableScrollRef} sort={sort} onSortChange={onSortChange} />
          </div>
          <PaginationBar page={page} totalPages={lastPage} totalRows={total}
            pageSize={pageSize} onPageChange={onPageChange} pageSizeOptions={pageSizeOptions}
            onPageSizeChange={onPageSizeChange} />
      </div>
      {view === 'board' && (
        <ApplicationsBoard rows={boardRows} phases={boardPhases} onMove={onMove}
          selectedId={selectedId} onSelect={onSelect}
          loading={wideLoading} error={wideError} />
      )}
    </div>
  )
}
