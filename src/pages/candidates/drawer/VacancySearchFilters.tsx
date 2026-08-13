import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, X } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { useDateFormat } from '@/lib/datetime'
import type { HoursRange } from '../hooks/vacancySearchFilters'

// Inline label — sits BESIDE its control instead of above it (Danny 09-08: a
// label-above-every-filter layout ran the bar over four lines with dead space).
const filterLabelInline: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }
// Reset trigger — a REAL button in the §4 soft-tint convention (tinted background,
// token text/icon, tinted border), never coloured text with an icon glued to it.
const resetButton: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
  fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
  color: 'var(--color-primary-text)',
  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
}
// Removable soft-chip (§4 convention) for an ACTIVE secondary filter parked in
// the DrawerFilterMenu popover — CALM-1 (P8-more-filters, batch 8): a filter
// that narrows the search must never be hidden-but-active, so it also surfaces
// here beside the trigger, with its own × to clear just that one filter.
const secondaryChip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 6px 4px 9px',
  fontSize: 11.5, fontWeight: 600, borderRadius: 999,
  color: 'var(--color-primary-text)',
  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
}
const secondaryChipRemove: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15,
  background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0,
}

// One label-beside-control filter unit — every filter is one line tall instead
// of two, wrapping as a single flex item instead of a fixed-width column.
function FilterField({ label, align = 'center', children }: { label: string; align?: CSSProperties['alignItems']; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: align, gap: 6 }}>
      <span style={filterLabelInline}>{label}</span>
      {children}
    </div>
  )
}

// A removable soft-chip beside the DrawerFilterMenu trigger — clicking × clears
// just this one secondary filter without opening the popover.
function SecondaryFilterChip({ label, ariaLabel, onRemove }: { label: string; ariaLabel: string; onRemove: () => void }) {
  return (
    <span style={secondaryChip}>
      {label}
      <button type="button" onClick={onRemove} aria-label={ariaLabel} style={secondaryChipRemove}>
        <X size={11} />
      </button>
    </span>
  )
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
  /** Whether ANY filter deviates from its starting value (drives the reset button). */
  filtersDirty: boolean
  onReset: () => void
}

/**
 * VacancySearchFilters — the filter bar of the candidate-side Match-zoeker
 * (VacancySearchTab). Purely presentational: every value and setter arrives as a
 * prop, no API calls and no business logic (§3 container/presentational split).
 * Every list is a searchable dropdown (SearchSelect), never a native <select>.
 *
 * P8-MORE-FILTERS (batch 8, decision = option B, approved): the primary row now
 * carries only Status/Functie/Contractvorm — the three filters used on nearly
 * every search. "Uren per week" and "Inzetbaar vanaf" moved into the shared
 * DrawerFilterMenu popover (its new 'range'/'date' row types) so the bar stays
 * calm; either one still shows as a REMOVABLE soft-chip beside the trigger the
 * moment it actually narrows the search — never hidden-but-active (§3).
 */
export default function VacancySearchFilters({
  candidateTitle, statusOptions, statuses, onStatusesChange,
  functionOptions, functions, onFunctionsChange, functionNotInLookup,
  contractvormOptions, contractvorm, onContractvormChange,
  hasHoursData, hoursRange, hoursRangeMax, onHoursRangeChange,
  hasAvailableFromData, availableFrom, onAvailableFromChange,
  filtersDirty, onReset,
}: VacancySearchFiltersProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()

  // Add/remove one value from a multi-select filter list.
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value]

  // Trigger text mirrors the shared filter-panel idiom (SearchSelectGroup / report
  // filters): a count once something is selected, else a calm "choose X" prompt.
  const triggerText = (selected: string[], label: string) =>
    selected.length > 0 ? t('common:filters.selectedCount', { count: selected.length }) : t('common:filters.choose', { label: label.toLowerCase() })

  // "Uren per week" is ACTIVE only once a handle actually left a domain end — a
  // handle parked at 0/max means "unbounded on that side" (see hoursOverlap),
  // so that resting state must never read as narrowed-and-removable.
  const hoursActive = hasHoursData && (hoursRange[0] > 0 || hoursRange[1] < hoursRangeMax)
  const hoursValueLabel = t('vacancySearch.hoursRangeValue', { min: hoursRange[0], max: hoursRange[1] })
  const resetHours = () => onHoursRangeChange([0, hoursRangeMax])
  const availableFromActive = hasAvailableFromData && availableFrom !== ''
  const clearAvailableFrom = () => onAvailableFromChange('')

  // The two secondary filters, as DrawerFilterMenu row configs — each only
  // offered once its own data is demonstrably present (offered-iff-read, mirrors
  // the inline gating this bar always had).
  const moreFilters: DrawerFilterConfig[] = [
    ...(hasHoursData ? [{
      type: 'range' as const, key: 'hours', label: t('vacancySearch.hoursPerWeek'),
      value: hoursRange, max: hoursRangeMax, onChange: onHoursRangeChange, valueLabel: hoursValueLabel,
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
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' }}>
      <FilterField label={t('vacancySearch.statuses')}>
        <SearchSelect
          options={statusOptions.map(s => ({ value: s.value, label: s.label }))}
          selected={statuses} onToggle={v => onStatusesChange(toggle(statuses, v))}
          triggerLabel={triggerText(statuses, t('vacancySearch.statuses'))}
        />
      </FilterField>
      {/* flex-start only when the ghost-filter hint below the control makes this field
          two lines tall; otherwise center like every other single-line filter field. */}
      <FilterField label={t('vacancySearch.functions')} align={functionNotInLookup ? 'flex-start' : 'center'}>
        <div>
          <SearchSelect
            options={functionOptions} selected={functions} onToggle={v => onFunctionsChange(toggle(functions, v))}
            triggerLabel={triggerText(functions, t('vacancySearch.functions'))}
          />
          {/* Ghost-filter hint (Danny 06-08 live feedback): the candidate's own title has
              no exact lookup match, so the filter above seeded empty (searches ALL functions)
              — say so instead of leaving a silent gap. */}
          {functionNotInLookup && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic', display: 'block' }}>
              {t('vacancySearch.functionNotInLookup', { title: candidateTitle })}
            </span>
          )}
        </div>
      </FilterField>
      <FilterField label={t('vacancySearch.contractForm')}>
        <SearchSelect
          options={contractvormOptions} selected={contractvorm} onToggle={v => onContractvormChange(toggle(contractvorm, v))}
          triggerLabel={triggerText(contractvorm, t('vacancySearch.contractForm'))}
        />
      </FilterField>
      {/* P8-more-filters: "Uren per week" + "Inzetbaar vanaf" now live behind this
          popover — the shared DrawerFilterMenu, its 'range'/'date' rows added for
          this card. No-op (renders nothing) once neither is offered. */}
      <DrawerFilterMenu filters={moreFilters} label={t('vacancySearch.moreFilters')}
        title={t('vacancySearch.moreFiltersTitle')} clearAllLabel={t('common:filters.clearAll')} />
      {/* Removable chips for whichever secondary filter is actually active — the
          "never hidden-but-active" half of the popover move. */}
      {hoursActive && (
        <SecondaryFilterChip label={t('vacancySearch.cardHours', { range: hoursValueLabel })}
          ariaLabel={t('vacancySearch.removeFilter', { label: t('vacancySearch.hoursPerWeek') })} onRemove={resetHours} />
      )}
      {availableFromActive && (
        <SecondaryFilterChip label={`${t('vacancySearch.availableFromFilter')}: ${formatDate(availableFrom)}`}
          ariaLabel={t('vacancySearch.removeFilter', { label: t('vacancySearch.availableFromFilter') })} onRemove={clearAvailableFrom} />
      )}
      {/* Reset (Danny 08-08, point 8) — only rendered when it would actually change
          something; a button that does nothing is noise. Lives in the SAME wrap
          flow as the filters: auto-margin pushes it right when there's room, and
          it wraps onto its own line (still right-aligned) when there isn't. */}
      {filtersDirty && (
        <button type="button" onClick={onReset} style={{ ...resetButton, marginLeft: 'auto' }}>
          <RotateCcw size={13} aria-hidden="true" />
          {t('vacancySearch.resetFilters')}
        </button>
      )}
    </div>
  )
}
