/**
 * VacanciesToolbar — the row under the InsightsRow (§4 spacing spec): the bulk
 * action bar once ≥1 row is selected, otherwise the "+ Add" / search / clear
 * controls, with the archived/trash/map quick-view toggles on the right. Pulled
 * out of VacanciesPage (§0.3 size split — mirrors CandidatesToolbar); purely a
 * thin layout + prop-forwarding component, no behaviour of its own. The bulk bar
 * arrives pre-composed as a node so its many data props stay wired in the page.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Map as MapIcon, Trash2 } from 'lucide-react'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import Button from '@/components/ui/Button'

interface VacanciesToolbarProps {
  selectedCount: number
  /** The composed VacanciesBulkBar (page keeps its data wiring). */
  bulkBar: ReactNode
  onAddOpen: () => void
  searchEpoch: number
  globalSearch: string
  onSearch: (v: string) => void
  anyFilterActive: boolean
  onClearFilters: () => void
  showArchived: boolean
  onToggleArchived: () => void
  showTrash: boolean
  onToggleTrash: () => void
  mapActive: boolean
  onToggleView: () => void
}

export default function VacanciesToolbar({
  selectedCount, bulkBar, onAddOpen, searchEpoch, globalSearch, onSearch,
  anyFilterActive, onClearFilters, showArchived, onToggleArchived,
  showTrash, onToggleTrash, mapActive, onToggleView,
}: VacanciesToolbarProps) {
  const { t } = useTranslation(['vacancies', 'common'])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
      {/* flex:1 so the selection bar stretches to the toggles (Danny 22-08: "de bar
          bij geselecteerde vacatures loopt niet door") — idle-mode children keep
          their intrinsic widths, so the + Nieuw/search row is unchanged. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {selectedCount > 0 ? bulkBar : (
          <>
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <Button variant="primary" size="md" onClick={onAddOpen}>
              + {t('page.add')}
            </Button>
            {/* EXCEL-VACATURES-1 (Danny 14-08, screenshot: "Excel importeren moet in de
                pop-up + nieuwe vacature niet hier boven de tabel!!"): the Excel/CSV
                import button moved off this toolbar into AddVacancyModal's header —
                mirrors KLANT-LAYOUT-3's identical move on the customer modal. */}
            {/* Shared header search (T10) — debounced, drives the same server-side ?search=. */}
            <HeaderSearch key={searchEpoch} onSearch={onSearch} defaultValue={globalSearch}
              placeholder={t('page.searchPlaceholder')} width={300} />
            <ClearFiltersButton active={anyFilterActive} onClear={onClearFilters} />
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
        {/* Archived ⇄ trash are mutually exclusive views (mirrors candidates). */}
        <QuickViewToggle active={showArchived} onToggle={onToggleArchived}
          label={t('page.archivedView')} color="var(--color-archive)" icon={Archive} />
        <QuickViewToggle active={showTrash} onToggle={onToggleTrash}
          label={t('common:trash.view')} color="var(--color-trash)" icon={Trash2} />
        {/* STRAAL-1: table ⇄ map (radius search) — always shown, mirroring the
            candidate blueprint (the API ships lat/lng + distance_km now). */}
        <QuickViewToggle active={mapActive} onToggle={onToggleView}
          label={t('common:map.view')} color="var(--color-map)" icon={MapIcon} />
        {/* No "Zonder AI-agent" toggle here (Danny 27-07): the KPI row already
            carries that view as a click-to-filter card, and the agent donut's
            "Geen agent" segment drives the same toggleWithoutAgent — a third
            control for one filter is duplication, not convenience. */}
        {/* No status bucket tabs here (Danny 14-08, PDF-punt "rode rij weg"):
            status filtering lives in the right filter panel now — a second
            toolbar control for the same statusBucket was duplication. The
            state itself stays: the panel, KPI cards and deep-links drive it. */}
      </div>
    </div>
  )
}
