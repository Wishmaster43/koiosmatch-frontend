import { useTranslation } from 'react-i18next'
import { Ban, Archive, Trash2, Map as MapIcon } from 'lucide-react'
import HeaderSearch from '@/components/ui/HeaderSearch'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import { BTN_H } from '@/config/buttonMetrics'
import CandidatesBulkBar from './CandidatesBulkBar'
import type { CandidatePool } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

interface BulkUser { id: Id; name: string }

// The bulk-mutation props CandidatesBulkBar needs — passed through as one group
// (composition over a 15-prop flat toolbar interface, §3).
interface BulkBarProps {
  onAddToPool: (pool: CandidatePool) => void
  onRemoveFromPool: (pool: CandidatePool) => void
  onSetOwner: (user: BulkUser) => void
  onSetStage: (stage: string) => void
  onSetTypes: (types: string[]) => void
  onSetConsent: (consent: Record<string, boolean>, label: string) => void
  onConvertPhase: (phase: string) => void
  onSetStatus: (status: string, label: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onAddNote: (text: string) => void
  onArchive: () => void
  canArchive: boolean
  onMerge: () => void
  canMerge: boolean
  users: BulkUser[]
  funnelTypes: LookupOption[]
  candidateTypes: LookupOption[]
  phases: LookupOption[]
  statuses: LookupOption[]
  selectedTags: string[]
}

interface CandidatesToolbarProps {
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
}

/**
 * CandidatesToolbar — the row under the InsightsRow (§4 spacing spec): the bulk
 * action bar once ≥1 row is selected, otherwise the "+ Add" / search / clear /
 * quick-view-toggle row. Pulled out of CandidatesPage (§0.3 size split, audit R1
 * item 1) — purely a thin layout + prop-forwarding component, no new behaviour.
 */
export default function CandidatesToolbar({
  selectedCount, onClearSelection, bulkBar, onAddOpen, searchEpoch, globalSearch, onSearch,
  anyFilterActive, onClearFilters, blacklistActive, onToggleBlacklist,
  showArchived, onToggleArchived, showTrash, onToggleTrash, view, onToggleView,
}: CandidatesToolbarProps) {
  const { t } = useTranslation(['candidates', 'common'])

  return (
    <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexShrink: 0 }}>
      {selectedCount > 0 ? (
        <CandidatesBulkBar count={selectedCount} onClear={onClearSelection}
          onAddToPool={bulkBar.onAddToPool} onRemoveFromPool={bulkBar.onRemoveFromPool}
          onSetOwner={bulkBar.onSetOwner} onSetStage={bulkBar.onSetStage} onSetTypes={bulkBar.onSetTypes} onSetConsent={bulkBar.onSetConsent}
          onConvertPhase={bulkBar.onConvertPhase} onSetStatus={bulkBar.onSetStatus} onAddTag={bulkBar.onAddTag}
          onRemoveTag={bulkBar.onRemoveTag} onAddNote={bulkBar.onAddNote} onArchive={bulkBar.onArchive}
          canArchive={bulkBar.canArchive}
          onMerge={bulkBar.onMerge} canMerge={bulkBar.canMerge}
          users={bulkBar.users} funnelTypes={bulkBar.funnelTypes} candidateTypes={bulkBar.candidateTypes}
          phases={bulkBar.phases} statuses={bulkBar.statuses} selectedTags={bulkBar.selectedTags} />
      ) : (
        <>
          {/* Add on the left (like Applications) — BTN_H (§4/§9, KANDIDAAT-100 #50): one
              explicit height for every text/action button, everywhere. */}
          <button onClick={onAddOpen} style={{ display: 'flex', alignItems: 'center', height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            + {t('page.add')}
          </button>
          {/* Shared header search (T10) — debounced, drives the same server-side ?search=. */}
          <HeaderSearch key={searchEpoch} onSearch={onSearch} defaultValue={globalSearch}
            placeholder={t('page.searchPlaceholder')} width={300} />
          <ClearFiltersButton active={anyFilterActive} onClear={onClearFilters} />
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
