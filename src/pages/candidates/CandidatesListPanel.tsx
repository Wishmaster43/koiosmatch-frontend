/**
 * CandidatesListPanel — the left "table area" of CandidatesPage: insights row,
 * transient action banner, toolbar (bulk bar / add + search + quick-view
 * toggles) and the table ⇄ map ViewSwitch with pagination. Pulled out of
 * CandidatesPage (§0.3 size split) — a thin, dumb rendering cluster; all
 * state/mutations still live in the hooks CandidatesPage owns and arrive here
 * as plain props/callbacks, so behaviour is unchanged.
 */
import { lazy, Suspense } from 'react'
import type { ComponentType, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRowJs from '@/components/insights/InsightsRow'
import ActionMessageBanner, { type ActionMessage } from '@/components/ui/ActionMessageBanner'
import ErrorBanner from '@/components/ui/ErrorBanner'
import ViewSwitch from '@/components/ui/ViewSwitch'
import PaginationBar from '@/components/ui/PaginationBar'
import CandidatesTable from './CandidatesTable'
import CandidatesToolbar, { type BulkBarProps } from './CandidatesToolbar'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Still-untyped JS component — declare the props this panel passes (typed boundary).
const InsightsRow = InsightsRowJs as ComponentType<{ donuts?: unknown[]; kpis?: unknown[]; clearTitle?: string; notice?: string }>
// STRAAL-1: the map view lazy-loads so Leaflet stays out of the main bundle (§9).
const CandidatesMapView = lazy(() => import('./CandidatesMapView'))

interface CandidatesListPanelProps {
  // Insights row
  insightDonuts: unknown[]
  insightKpis: unknown[]
  statsFailed: boolean
  total: number
  loadedCount: number
  // Transient action-feedback banner
  actionMsg: ActionMessage | null
  onDismissMessage: () => void
  // Toolbar: selection, bulk bar, add/search/clear, quick-view toggles
  selectedCount: number
  onClearSelection: () => void
  bulkBar: BulkBarProps
  onAddOpen: () => void
  searchEpoch: number
  globalSearch: string
  onSearch: (v: string) => void
  anyFilterActive: boolean
  onClearFilters: () => void
  blacklistActive: boolean
  onToggleBlacklist: () => void
  showArchived: boolean
  onToggleArchived: () => void
  showTrash: boolean
  onToggleTrash: () => void
  view: 'table' | 'map'
  onToggleView: () => void
  // Table ⇄ map content
  tableScrollRef: RefObject<HTMLDivElement | null>
  error: string | null
  filtered: Candidate[]
  loading: boolean
  selectedId?: Id
  onSelectCandidate: (row: Candidate) => void
  selectedIds: Set<Id>
  onToggleRow: (id: Id) => void
  onToggleAll: (ids: Id[], allSelected: boolean) => void
  page: number
  lastPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  // Map view (STRAAL-1)
  mapCenter: { lat: number; lng: number }
  mapRadius: number
  mapStraalActive: boolean
  onMapCenterChange: (lat: number, lng: number) => void
  onMapRadiusChange: (km: number) => void
  onMapClearRadius?: () => void
}

export default function CandidatesListPanel({
  insightDonuts, insightKpis, statsFailed, total, loadedCount,
  actionMsg, onDismissMessage,
  selectedCount, onClearSelection, bulkBar, onAddOpen, searchEpoch, globalSearch, onSearch,
  anyFilterActive, onClearFilters, blacklistActive, onToggleBlacklist,
  showArchived, onToggleArchived, showTrash, onToggleTrash, view, onToggleView,
  tableScrollRef, error, filtered, loading, selectedId, onSelectCandidate,
  selectedIds, onToggleRow, onToggleAll, page, lastPage, pageSize, onPageChange, onPageSizeChange,
  mapCenter, mapRadius, mapStraalActive, onMapCenterChange, onMapRadiusChange, onMapClearRadius,
}: CandidatesListPanelProps) {
  const { t } = useTranslation(['candidates', 'common'])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <InsightsRow donuts={insightDonuts} kpis={insightKpis}
        clearTitle={t('analytics.clearFilter', { defaultValue: 'Filter wissen' })}
        // Data honesty (STATS-OOM-1): when the server-wide stats call failed and
        // there is more data than the loaded page, the cards fall back to
        // page-scope counts — label them instead of presenting them as totals.
        notice={statsFailed && total > loadedCount ? t('analytics.pageScopeNotice') : undefined} />

      {/* Transient feedback for bulk mutations (aria-live for screen readers) —
          shared banner (§0.3 split, audit R1 item 1: was copy-pasted per page). */}
      <ActionMessageBanner msg={actionMsg} onDismiss={onDismissMessage} dismissLabel={t('close', { ns: 'common' })} />

      {/* Toolbar — bulk-bar zodra er selectie is, anders de toevoeg-knop (§0.3 split
          into its own component, audit R1 item 1). */}
      <CandidatesToolbar
        selectedCount={selectedCount}
        onClearSelection={onClearSelection}
        bulkBar={bulkBar}
        onAddOpen={onAddOpen}
        searchEpoch={searchEpoch} globalSearch={globalSearch} onSearch={onSearch}
        anyFilterActive={anyFilterActive} onClearFilters={onClearFilters}
        blacklistActive={blacklistActive} onToggleBlacklist={onToggleBlacklist}
        showArchived={showArchived} onToggleArchived={onToggleArchived}
        showTrash={showTrash} onToggleTrash={onToggleTrash}
        view={view} onToggleView={onToggleView}
      />

      {/* Table ⇄ map — ViewSwitch keeps both mounted (display toggle, not unmount)
          so the table's virtualizer never remeasures 0 on returning from the
          map (§ViewSwitch). Map LEFT, filtered candidate table RIGHT when active,
          one radius search drives both panes. Lazy Leaflet load. */}
      <ViewSwitch active={view} views={[
        {
          id: 'table',
          render: () => (
            <>
              <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 24px 16px' }}>
                {error && <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>}
                <CandidatesTable
                  rows={filtered}
                  loading={loading}
                  selectedId={selectedId}
                  onSelect={onSelectCandidate}
                  onOpenTab={onSelectCandidate}
                  selectable
                  selectedIds={selectedIds}
                  onToggleRow={onToggleRow}
                  onToggleAll={onToggleAll}
                  stickyHeader
                  scrollParentRef={tableScrollRef}
                />
              </div>
              <PaginationBar
                page={page}
                totalPages={lastPage}
                totalRows={total}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </>
          ),
        },
        {
          id: 'map',
          render: () => (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '0 24px 16px' }}>
              <div style={{ flex: '1.1 1 0', minWidth: 400, display: 'flex', flexDirection: 'column' }}>
                <Suspense fallback={<div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:map.loading')}</div>}>
                  <CandidatesMapView rows={filtered} center={mapCenter} radiusKm={mapStraalActive ? mapRadius : 0} padded={false}
                    onCenterChange={onMapCenterChange}
                    onRadiusChange={onMapRadiusChange}
                    onClearRadius={mapStraalActive ? onMapClearRadius : undefined}
                    onPick={(id) => onSelectCandidate({ id } as Candidate)} />
                </Suspense>
              </div>
              {/* Right pane: the same server-filtered rows as a table (row click = drawer). */}
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                  <CandidatesTable rows={filtered} loading={loading} selectedId={selectedId}
                    onSelect={onSelectCandidate} onOpenTab={onSelectCandidate} />
                </div>
                <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                  onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
              </div>
            </div>
          ),
        },
      ]} />
    </div>
  )
}
