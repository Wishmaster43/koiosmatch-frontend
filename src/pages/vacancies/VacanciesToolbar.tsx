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
import { Archive, Map as MapIcon, Trash2, FileSpreadsheet } from 'lucide-react'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { BTN_H } from '@/config/buttonMetrics'

interface VacanciesToolbarProps {
  selectedCount: number
  /** The composed VacanciesBulkBar (page keeps its data wiring). */
  bulkBar: ReactNode
  onAddOpen: () => void
  // PDF-VACATURES-2026-08-14 point 7: opens the real full-screen import wizard
  // preselected on vacancies; the button itself only renders when `canImport`.
  onImportOpen: () => void
  canImport: boolean
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
  selectedCount, bulkBar, onAddOpen, onImportOpen, canImport, searchEpoch, globalSearch, onSearch,
  anyFilterActive, onClearFilters, showArchived, onToggleArchived,
  showTrash, onToggleTrash, mapActive, onToggleView,
}: VacanciesToolbarProps) {
  const { t } = useTranslation(['vacancies', 'common'])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {selectedCount > 0 ? bulkBar : (
          <>
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <button onClick={onAddOpen} style={{ display: 'flex', alignItems: 'center', height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + {t('page.add')}
            </button>
            {/* PDF-VACATURES-2026-08-14 point 7: Excel/CSV bulk-upload, one or many
                vacancies — jumps to the real import wizard (§11: reuse, no second
                upload implementation); permission-gated on vacancies.create, the
                same right the wizard's own confirm step needs. */}
            {canImport && (
              <button type="button" onClick={onImportOpen} title={t('page.importTitle')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600,
                  background: 'none', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                <FileSpreadsheet size={14} /> {t('page.import')}
              </button>
            )}
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
