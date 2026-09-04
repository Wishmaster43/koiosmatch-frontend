/**
 * OutreachToolbar — the row under the insights strip: "+ Bellijst" on the
 * left, search + clear-filters, and the archived/trash/view toggles on the
 * right (mirrors the §3A blueprint toolbar spacing). Presentational only —
 * extracted from OutreachPage.tsx (§0.3 size split).
 */
import { LayoutList, Kanban, Archive, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { TOOLBAR_ROW_STYLE } from '@/components/ui/toolbarRow'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import ViewModeToggle from '@/components/ui/ViewModeToggle'

interface OutreachToolbarProps {
  onCreate: () => void
  // OPENERS-HIDE-1: the "+ Bellijst" opener renders only when the reader holds outreach.create.
  canCreate: boolean
  // Bumped by the page on clear-all so the self-stateful search input remounts.
  searchEpoch: number
  onSearch: (q: string) => void
  anyFilterActive: boolean
  onClearFilters: () => void
  showArchived: boolean
  onToggleArchived: () => void
  showTrash: boolean
  onToggleTrash: () => void
  view: 'table' | 'board'
  onViewChange: (v: 'table' | 'board') => void
}

// Create button + search + clear-filters + archived/trash/view toggles (see file docblock).
export default function OutreachToolbar({
  onCreate, canCreate, searchEpoch, onSearch, anyFilterActive, onClearFilters,
  showArchived, onToggleArchived, showTrash, onToggleTrash, view, onViewChange,
}: OutreachToolbarProps) {
  const { t } = useTranslation('outreach')
  return (
    <div style={{ ...TOOLBAR_ROW_STYLE, flexShrink: 0 }}>
      {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
          OPENERS-HIDE-1: hidden without outreach.create (RIGHTS-GATE-OPENERS-1 idiom). */}
      {canCreate && (
        <Button variant="primary" size="md" onClick={onCreate}>
          <Plus size={15} /> {t('new')}
        </Button>
      )}
      <HeaderSearch key={searchEpoch} onSearch={onSearch} placeholder={t('page.searchPlaceholder')} width={280} />
      <ClearFiltersButton active={anyFilterActive} onClear={onClearFilters} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Archived (soft-deleted) — shared quick-view toggle (§4); exclusive
            with the trash view below (TRASH-OVERAL-2, mirrors candidates). */}
        <QuickViewToggle active={showArchived} onToggle={onToggleArchived}
          label={t('view.archived')} color="var(--color-archive)" icon={Archive} />
        {/* Prullenbak (pending erase) — same shared toggle, candidates' trash colour. */}
        <QuickViewToggle active={showTrash} onToggle={onToggleTrash}
          label={t('common:trash.view')} color="var(--color-trash)" icon={Trash2} />
        {/* Table / board view toggle — shared ViewModeToggle (§4, audit r5: this was
            the last hand-rolled solid-fill switcher after MatchesPage/TasksPage/
            ApplicationsPage moved to the shared component). */}
        <ViewModeToggle value={view} onChange={onViewChange} options={[
          { id: 'table', icon: LayoutList, label: t('view.table') },
          { id: 'board', icon: Kanban, label: t('view.board') },
        ]} />
      </div>
    </div>
  )
}
