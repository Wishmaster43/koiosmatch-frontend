// VacancySearchFilters — the fixed trigger-pill row for the candidate's vacancy
// search (GeoSearchShell's trigger-row slot); VacancySearchActiveFilters below
// builds the chips-row slot. See the GEOSEARCH-1 comment further down for the split.
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { useDateFormat } from '@/lib/datetime'
// HUISSTIJL-1: the shared muted-caption atom (identity-only swap).
import { Caption } from '@/components/ui/typography'
import ActiveFilterChip from '@/components/search/ActiveFilterChip'
import type { HoursRange } from '../hooks/vacancySearchFilters'
import FilterTriggerPill from '@/components/ui/FilterTriggerPill'

// GEOSEARCH-1 (Danny 22-08): the outer column layout (trigger row + a
// situational chips row) now lives in the shared GeoSearchShell — this file
// only builds the CONTENT of those two slots: VacancySearchFilters (default
// export) is the fixed trigger-pill row, VacancySearchActiveFilters (below) is
// the chips row. VacancySearchTab wires both into GeoSearchShell's props.

// Reset — a small text item (not components/ui/Button: its 11.5/600, zero-padding
// footprint must sit flush with the chip row's own typography, never a boxed button).
const resetTextItem: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0,
  fontSize: 11.5, fontWeight: 600, color: 'var(--color-primary-text)',
  background: 'none', border: 'none', cursor: 'pointer',
}

// One primary-field trigger: the field's own label lives INSIDE the button
// ("Vacaturestatus · 2"), mirroring the DrawerFilterMenu "More filters" idiom.
// Delegates to the ONE shared pill (Opus F: the two search twins had diverged).
function PrimaryFilterTrigger({ label, count }: { label: string; count: number }) {
  return <FilterTriggerPill label={label} count={count} />
}

interface VacancySearchFiltersProps {
  /** The candidate's own function title — only used for the not-in-lookup hint. */
  candidateTitle?: string | null
  statusOptions: Array<{ value: string; label: string }>
  statuses: string[]
  onStatusesChange: (next: string[]) => void
  functionOptions: string[]
  functions: string[]
  onFunctionsChange: (next: string[]) => void
  functionNotInLookup: boolean
  contractvormOptions: string[]
  contractvorm: string[]
  onContractvormChange: (next: string[]) => void
  /** Gated (offered-iff-read): the weekly-hours filter only renders once rows carry it. */
  hasHoursData: boolean
  hoursRange: HoursRange
  hoursRangeMax: number
  onHoursRangeChange: (next: HoursRange) => void
  /** Gated the same way, on the vacancy start_date field. */
  hasAvailableFromData: boolean
  availableFrom: string
  onAvailableFromChange: (next: string) => void
}

/**
 * VacancySearchFilters — the TRIGGER ROW of the candidate-side Match-zoeker
 * (VacancySearchTab), rendered into GeoSearchShell's `triggers` slot. Purely
 * presentational: every value and setter arrives as a prop, no API calls and
 * no business logic (§3 container/presentational split). Every list is a
 * searchable dropdown (SearchSelect), never a native <select>.
 *
 * FILTER-VLAK-1 (Danny 13-08): Status/Functie/Contractvorm carry their label
 * INSIDE the trigger ("Vacaturestatus · 2") plus the "More filters" popover for
 * the two gated secondary filters (hours/available-from). GEOSEARCH-1 (22-08)
 * moved the chips row + reset out of this component into
 * VacancySearchActiveFilters below, so both live behind ONE shared shell.
 */
export default function VacancySearchFilters({
  candidateTitle, statusOptions, statuses, onStatusesChange,
  functionOptions, functions, onFunctionsChange, functionNotInLookup,
  contractvormOptions, contractvorm, onContractvormChange,
  hasHoursData, hoursRange, hoursRangeMax, onHoursRangeChange,
  hasAvailableFromData, availableFrom, onAvailableFromChange,
}: VacancySearchFiltersProps) {
  const { t } = useTranslation('candidates')

  // Add/remove one value from a multi-select filter list.
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value]

  // "Uren per week" is ACTIVE only once a handle actually left a domain end —
  // needed here too so the popover's own clear-all can reset this row.
  const hoursActive = hasHoursData && (hoursRange[0] > 0 || hoursRange[1] < hoursRangeMax)
  const resetHours = () => onHoursRangeChange([0, hoursRangeMax])

  // The two secondary filters, as DrawerFilterMenu row configs — each only
  // offered once its own data is demonstrably present (offered-iff-read).
  const moreFilters: DrawerFilterConfig[] = [
    ...(hasHoursData ? [{
      type: 'range' as const, key: 'hours', label: t('vacancySearch.hoursPerWeek'),
      value: hoursRange, max: hoursRangeMax, onChange: onHoursRangeChange,
      valueLabel: t('vacancySearch.hoursRangeValue', { min: hoursRange[0], max: hoursRange[1] }),
      ariaLabels: [
        `${t('vacancySearch.hoursPerWeek')} ${t('vacancySearch.hoursMinPlaceholder')}`,
        `${t('vacancySearch.hoursPerWeek')} ${t('vacancySearch.hoursMaxPlaceholder')}`,
      ] as [string, string],
      active: hoursActive, onReset: resetHours,
    }] : []),
    ...(hasAvailableFromData ? [{
      type: 'date' as const, key: 'availableFrom', label: t('vacancySearch.availableFromFilter'),
      value: availableFrom, onChange: onAvailableFromChange, placeholder: t('vacancySearch.availableFromFilter'),
    }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, flexWrap: 'wrap' }}>
      <SearchSelect
        options={statusOptions.map(s => ({ value: s.value, label: s.label }))}
        selected={statuses} onToggle={v => onStatusesChange(toggle(statuses, v))}
        renderTrigger={toggleOpen => (
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- zero-chrome SearchSelect renderTrigger wrapper (no fill/border/padding of its own); visible identity is entirely FilterTriggerPill's, mirrors TargetsTab.tsx/StatusFilterSelect.tsx
          <button type="button" onClick={toggleOpen} aria-label={`${t('vacancySearch.statuses')}${statuses.length > 0 ? ` (${statuses.length})` : ''}`} style={{ background: 'none', border: 'none', padding: 0 }}>
            <PrimaryFilterTrigger label={t('vacancySearch.statuses')} count={statuses.length} />
          </button>
        )}
      />
      <div>
        <SearchSelect
          options={functionOptions} selected={functions} onToggle={v => onFunctionsChange(toggle(functions, v))}
          renderTrigger={toggleOpen => (
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- zero-chrome SearchSelect renderTrigger wrapper, see the status trigger above
            <button type="button" onClick={toggleOpen} aria-label={`${t('vacancySearch.functions')}${functions.length > 0 ? ` (${functions.length})` : ''}`} style={{ background: 'none', border: 'none', padding: 0 }}>
              <PrimaryFilterTrigger label={t('vacancySearch.functions')} count={functions.length} />
            </button>
          )}
        />
        {/* Ghost-filter hint (Danny 06-08 live feedback): the candidate's own title has
            no exact lookup match, so the filter above seeded empty (searches ALL functions)
            — say so instead of leaving a silent gap. */}
        {functionNotInLookup && (
          // HUISSTIJL-1: identical 11/400/var(--text-muted) render.
          <Caption style={{ marginTop: 2, fontStyle: 'italic', display: 'block' }}>
            {t('vacancySearch.functionNotInLookup', { title: candidateTitle })}
          </Caption>
        )}
      </div>
      <SearchSelect
        options={contractvormOptions} selected={contractvorm} onToggle={v => onContractvormChange(toggle(contractvorm, v))}
        renderTrigger={toggleOpen => (
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- zero-chrome SearchSelect renderTrigger wrapper, see the status trigger above
          <button type="button" onClick={toggleOpen} aria-label={`${t('vacancySearch.contractForm')}${contractvorm.length > 0 ? ` (${contractvorm.length})` : ''}`} style={{ background: 'none', border: 'none', padding: 0 }}>
            <PrimaryFilterTrigger label={t('vacancySearch.contractForm')} count={contractvorm.length} />
          </button>
        )}
      />
      {/* P8-more-filters: "Uren per week" + "Inzetbaar vanaf" live behind this
          popover — the shared DrawerFilterMenu. No-op (renders nothing) once
          neither is offered. */}
      <DrawerFilterMenu filters={moreFilters} label={t('vacancySearch.moreFilters')}
        title={t('vacancySearch.moreFiltersTitle')} clearAllLabel={t('common:filters.clearAll')} />
    </div>
  )
}

interface VacancySearchActiveFiltersProps {
  hasHoursData: boolean
  hoursRange: HoursRange
  hoursRangeMax: number
  onHoursRangeChange: (next: HoursRange) => void
  hasAvailableFromData: boolean
  availableFrom: string
  onAvailableFromChange: (next: string) => void
  /** Whether ANY filter deviates from its starting value (drives the reset link). */
  filtersDirty: boolean
  onReset: () => void
}

/**
 * VacancySearchActiveFilters — the CHIPS ROW of the candidate-side Match-zoeker,
 * rendered into GeoSearchShell's `chips` slot. CALM-1 (P8-more-filters): a
 * filter that narrows the search must never be hidden-but-active, so the two
 * secondary ("Meer filters") narrowings surface here too, each with its own ×
 * to clear just that one filter — plus a "Filters herstellen" link once ANY
 * filter (including radius/status/function/contractvorm) has drifted from its
 * starting value. Returns null (no wrapper) while nothing is active, so
 * GeoSearchShell adds no empty row.
 */
export function VacancySearchActiveFilters({
  hasHoursData, hoursRange, hoursRangeMax, onHoursRangeChange,
  hasAvailableFromData, availableFrom, onAvailableFromChange,
  filtersDirty, onReset,
}: VacancySearchActiveFiltersProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()

  const hoursActive = hasHoursData && (hoursRange[0] > 0 || hoursRange[1] < hoursRangeMax)
  const hoursValueLabel = t('vacancySearch.hoursRangeValue', { min: hoursRange[0], max: hoursRange[1] })
  const resetHours = () => onHoursRangeChange([0, hoursRangeMax])
  const availableFromActive = hasAvailableFromData && availableFrom !== ''
  const clearAvailableFrom = () => onAvailableFromChange('')

  // Only rendered once something is actually active — the reset flag already
  // covers radius/status/functions/contractvorm too.
  const showSecondaryRow = filtersDirty || hoursActive || availableFromActive
  if (!showSecondaryRow) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px 10px', flexWrap: 'wrap' }}>
      {hoursActive && (
        <ActiveFilterChip label={t('vacancySearch.cardHours', { range: hoursValueLabel })}
          ariaLabel={t('vacancySearch.removeFilter', { label: t('vacancySearch.hoursPerWeek') })} onRemove={resetHours} />
      )}
      {availableFromActive && (
        <ActiveFilterChip label={`${t('vacancySearch.availableFromFilter')}: ${formatDate(availableFrom)}`}
          ariaLabel={t('vacancySearch.removeFilter', { label: t('vacancySearch.availableFromFilter') })} onRemove={clearAvailableFrom} />
      )}
      {/* Reset (Danny 08-08, point 8) — only rendered when it would actually change
          something; a button that does nothing is noise. */}
      {filtersDirty && (
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- deliberately matches this chip row's own 11.5/600 text-link footprint (not a Button size), mirrors DrawerFilterMenu's own reasoned trigger exception
        <button type="button" onClick={onReset} style={{ ...resetTextItem, marginLeft: 'auto' }}>
          <RotateCcw size={12} aria-hidden="true" />
          {t('vacancySearch.resetFilters')}
        </button>
      )}
    </div>
  )
}
