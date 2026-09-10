// CandidatesToolbar — the toolbar row under the candidates InsightsRow: bulk action
// bar once rows are selected, otherwise + Add / search / quick-view toggles. See
// the fuller doc comment on the component below.
import { useTranslation } from 'react-i18next'
import { Ban, Archive, Trash2, Map as MapIcon } from 'lucide-react'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import ListToolbarCore from '@/components/ui/ListToolbarCore'
import CandidatesBulkBar, { type CandidatesBulkBarProps } from './CandidatesBulkBar'
import { TOOLBAR_ROW_STYLE } from '@/components/ui/toolbarRow'

// The bulk-mutation props CandidatesBulkBar needs — passed through as one group
// (composition over a 15-prop flat toolbar interface, §3). Derived from the bar's
// own prop type (never re-declared): the bar's selection-scope fields live on the
// toolbar itself instead, and `canArchive`/`onMerge`/`canMerge` are genuinely
// required here (the bar only makes them optional for its own default values).
// Exported so CandidatesListPanel can type its own `bulkBar` pass-through prop.
export type BulkBarProps = Omit<CandidatesBulkBarProps,
  'count' | 'onClear' | 'bulkScope' | 'onSetBulkScope' | 'filteredTotal' | 'anyFilterActive' |
  'canArchive' | 'onMerge' | 'canMerge' | 'users' | 'funnelTypes' | 'candidateTypes' | 'phases' | 'statuses' | 'selectedTags'
> & {
  canArchive: boolean
  onMerge: () => void
  canMerge: boolean
  users: NonNullable<CandidatesBulkBarProps['users']>
  funnelTypes: NonNullable<CandidatesBulkBarProps['funnelTypes']>
  candidateTypes: NonNullable<CandidatesBulkBarProps['candidateTypes']>
  phases: NonNullable<CandidatesBulkBarProps['phases']>
  statuses: NonNullable<CandidatesBulkBarProps['statuses']>
  selectedTags: NonNullable<CandidatesBulkBarProps['selectedTags']>
}

// Exported so CandidatesListPanel derives its own props from this shape instead
// of re-declaring the same toolbar-row field list.
export interface CandidatesToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  bulkBar: BulkBarProps
  // BULK-FILTERSET-1: ids-vs-filters scope, passed straight through to the bar.
  bulkScope: 'selected' | 'filtered'
  onSetBulkScope: (scope: 'selected' | 'filtered') => void
  filteredTotal: number
  onAddOpen: () => void
  // OPENERS-HIDE-1: the "+ Add" opener renders only when the reader holds candidates.create.
  canCreate: boolean
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
}

/**
 * CandidatesToolbar — the row under the InsightsRow (§4 spacing spec): the bulk
 * action bar once ≥1 row is selected, otherwise the "+ Add" / search / clear /
 * quick-view-toggle row. Pulled out of CandidatesPage (§0.3 size split, audit R1
 * item 1) — purely a thin layout + prop-forwarding component, no new behaviour.
 */
export default function CandidatesToolbar({
  selectedCount, onClearSelection, bulkBar, bulkScope, onSetBulkScope, filteredTotal, onAddOpen, canCreate, searchEpoch, globalSearch, onSearch,
  anyFilterActive, onClearFilters, blacklistActive, onToggleBlacklist,
  showArchived, onToggleArchived, showTrash, onToggleTrash, view, onToggleView,
}: CandidatesToolbarProps) {
  const { t } = useTranslation(['candidates', 'common'])

  return (
    <div style={{ ...TOOLBAR_ROW_STYLE, flexShrink: 0 }}>
      {selectedCount > 0 ? (
        <CandidatesBulkBar count={selectedCount} onClear={onClearSelection}
          bulkScope={bulkScope} onSetBulkScope={onSetBulkScope} filteredTotal={filteredTotal} anyFilterActive={anyFilterActive}
          onAddToPool={bulkBar.onAddToPool} onRemoveFromPool={bulkBar.onRemoveFromPool}
          onSetOwner={bulkBar.onSetOwner} onSetStage={bulkBar.onSetStage} onSetTypes={bulkBar.onSetTypes} onSetConsent={bulkBar.onSetConsent}
          onConvertPhase={bulkBar.onConvertPhase} onSetStatus={bulkBar.onSetStatus} onAddTag={bulkBar.onAddTag}
          onRemoveTag={bulkBar.onRemoveTag} onAddNote={bulkBar.onAddNote} onArchive={bulkBar.onArchive}
          canArchive={bulkBar.canArchive}
          onMerge={bulkBar.onMerge} canMerge={bulkBar.canMerge}
          onManageByApplication={bulkBar.onManageByApplication}
          onGeocode={bulkBar.onGeocode} canGeocode={bulkBar.canGeocode}
          onCoupleBackoffice={bulkBar.onCoupleBackoffice}
          users={bulkBar.users} funnelTypes={bulkBar.funnelTypes} candidateTypes={bulkBar.candidateTypes}
          phases={bulkBar.phases} statuses={bulkBar.statuses} selectedTags={bulkBar.selectedTags} />
      ) : (
        <>
          {/* Add on the left (like Applications) — BTN_H (§4/§9, KANDIDAAT-100 #50): one
              explicit height for every text/action button, everywhere. OPENERS-HIDE-1:
              hidden (not just click-gated) without candidates.create.
              Shared header search (T10) — debounced, drives the same server-side ?search=. */}
          <ListToolbarCore canCreate={canCreate} onAdd={onAddOpen} addContent={<>+ {t('page.add')}</>}
            searchEpoch={searchEpoch} defaultSearch={globalSearch} onSearch={onSearch} searchPlaceholder={t('page.searchPlaceholder')}
            anyFilterActive={anyFilterActive} onClearFilters={onClearFilters} />
          {/* Quick-view toggles on the right: blacklisted-only + archived-only */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {/* Shared quick-view toggles (§4 soft convention) — one component everywhere. */}
            <QuickViewToggle active={blacklistActive} onToggle={onToggleBlacklist}
              label={t('page.blacklistView')} color="var(--color-danger)" icon={Ban} />
            <QuickViewToggle active={showArchived} onToggle={onToggleArchived}
              label={t('page.archivedView')} color="var(--color-archive)" icon={Archive} />
            <QuickViewToggle active={showTrash} onToggle={onToggleTrash}
              label={t('erase.trashView')} color="var(--color-trash)" icon={Trash2} />
            {/* STRAAL-1: table ⇄ map (radius search) — same shared toggle look. */}
            <QuickViewToggle active={view === 'map'} onToggle={onToggleView}
              label={t('common:map.view')} color="var(--color-map)" icon={MapIcon} />
          </div>
        </>
      )}
    </div>
  )
}
