/**
 * CustomersToolbar — the row under the insights strip: bulk bar when rows are
 * selected, otherwise Add/Search/Clear + the archived/trash/map quick-views.
 * Pure extraction from CustomersPage (§0.3 split) — no behavior change.
 */
import type { Dispatch, SetStateAction, ComponentProps } from 'react'
import type { TFunction } from 'i18next'
import { Archive, Map as MapIcon, Trash2 } from 'lucide-react'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import Button from '@/components/ui/Button'
import CustomersBulkBar from './CustomersBulkBar'
import type { Id, LookupOption } from '@/types/common'

interface AppUser { id: Id; name: string; avatar_color?: string }
// Mirrors CustomersBulkBar's own (unexported) prop shape for the handlers it forwards.
type BulkBarProps = ComponentProps<typeof CustomersBulkBar>

interface Props {
  t: TFunction
  selectedCount: number
  onClearSelection: () => void
  bulk: {
    onSetOwner: BulkBarProps['onSetOwner']
    onSetStatus: BulkBarProps['onSetStatus']
    onAddTag: BulkBarProps['onAddTag']
    onRemoveTag: BulkBarProps['onRemoveTag']
    onAddNote: BulkBarProps['onAddNote']
    onArchive: BulkBarProps['onArchive']
    onGeocode: BulkBarProps['onGeocode']
    onCoupleBackoffice: BulkBarProps['onCoupleBackoffice']
    selectedTags: BulkBarProps['selectedTags']
  }
  canArchive: boolean
  canGeocode: boolean
  users: AppUser[]
  statuses: LookupOption[]
  onAdd: () => void
  searchEpoch: number
  globalSearch: string
  onSearch: (v: string) => void
  anyFilterActive: boolean
  onClearAllFilters: () => void
  showArchived: boolean
  setShowArchived: Dispatch<SetStateAction<boolean>>
  showTrash: boolean
  setShowTrash: Dispatch<SetStateAction<boolean>>
  view: 'table' | 'map'
  setView: Dispatch<SetStateAction<'table' | 'map'>>
}

// The toolbar row: bulk bar in selection mode, otherwise add/search/clear + view toggles.
export default function CustomersToolbar({
  t, selectedCount, onClearSelection, bulk, canArchive, canGeocode, users, statuses, onAdd,
  searchEpoch, globalSearch, onSearch, anyFilterActive, onClearAllFilters,
  showArchived, setShowArchived, showTrash, setShowTrash, view, setView,
}: Props) {
  return (
    <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexShrink: 0 }}>
      {selectedCount > 0 ? (
        <CustomersBulkBar count={selectedCount} onClear={onClearSelection}
          onSetOwner={bulk.onSetOwner} onSetStatus={bulk.onSetStatus} onAddTag={bulk.onAddTag}
          onRemoveTag={bulk.onRemoveTag} onAddNote={bulk.onAddNote} onArchive={bulk.onArchive}
          canArchive={canArchive}
          onGeocode={bulk.onGeocode} canGeocode={canGeocode}
          onCoupleBackoffice={bulk.onCoupleBackoffice}
          users={users} statuses={statuses} selectedTags={bulk.selectedTags} />
      ) : (
        <>
          {/* Add on the left (like Applications/Candidates) — BTN_H (§4/§9): one
              explicit height for every text/action button, everywhere. */}
          <Button variant="primary" size="md" onClick={onAdd}>
            + {t('page.add')}
          </Button>
          {/* Shared header search (T10) — debounced, drives the same server-side ?search=. */}
          <HeaderSearch key={searchEpoch} onSearch={onSearch} defaultValue={globalSearch}
            placeholder={t('page.searchPlaceholder')} width={300} />
          <ClearFiltersButton active={anyFilterActive} onClear={onClearAllFilters} />
          {/* Archived + map quick-views on the right — shared toggles (§4), map last
              to mirror the candidate blueprint's toggle order (§3A). */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {/* Archived ⇄ trash are mutually exclusive views (mirrors candidates). */}
            <QuickViewToggle active={showArchived} onToggle={() => { setShowArchived(v => !v); setShowTrash(false) }}
              label={t('page.archivedView')} color="var(--color-archive)" icon={Archive} />
            <QuickViewToggle active={showTrash} onToggle={() => { setShowTrash(v => !v); setShowArchived(false) }}
              label={t('common:trash.view')} color="var(--color-trash)" icon={Trash2} />
            <QuickViewToggle active={view === 'map'} onToggle={() => setView(v => (v === 'map' ? 'table' : 'map'))}
              label={t('common:map.view')} color="var(--color-map)" icon={MapIcon} />
          </div>
        </>
      )}
    </div>
  )
}
