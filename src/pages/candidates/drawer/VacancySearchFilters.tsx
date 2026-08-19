import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, X } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { useDateFormat } from '@/lib/datetime'
// HUISSTIJL-1: the shared muted-caption atom (identity-only swap).
import { Caption } from '@/components/ui/typography'
import type { HoursRange } from '../hooks/vacancySearchFilters'

// FILTER-VLAK-1 (Danny 13-08, rustplan step 4): the ONE soft-tint recipe every
// trigger/chip/action in this bar shares — pulled out of the three near-duplicate
// inline style objects the previous version carried, so a future tweak (e.g. the
// tint percentage) lands once instead of three times.
const softTint = (activeOrOpen: boolean) => ({
  background: `color-mix(in srgb, var(--color-primary) ${activeOrOpen ? 16 : 10}%, transparent)`,
  border: `1px solid color-mix(in srgb, var(--color-primary) ${activeOrOpen ? 45 : 30}%, transparent)`,
})
// Primary-field trigger — same footprint/idiom as DrawerFilterMenu's own "More
// filters" button (height 26, fontSize 11.5, radius 6, badge-on-active) so the
// three fixed filters and the popover trigger read as ONE family of controls.
// PRIMAIR-VLAK-1 (Danny 19-08): accent triggers paint the button trio; the
// count badge inverts so it stays visible on the solid fill.
const filterTrigger = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px',
  whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: active ? 600 : 500, borderRadius: 6,
  cursor: 'pointer', color: 'var(--button-ink)',
  background: 'var(--button-fill)', border: '1px solid var(--button-border)',
})
const filterTriggerBadge: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15,
  padding: '0 4px', borderRadius: 999, background: 'var(--button-ink)', color: 'var(--color-primary-text)',
  fontSize: 10, fontWeight: 700, lineHeight: 1,
}
// Removable soft-chip (§4 convention) for an ACTIVE secondary filter parked in
// the DrawerFilterMenu popover — CALM-1 (P8-more-filters, batch 8): a filter
// that narrows the search must never be hidden-but-active, so it also surfaces
// here beside the trigger, with its own × to clear just that one filter.
const secondaryChip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 6px 4px 9px',
  fontSize: 11.5, fontWeight: 600, borderRadius: 999,
  color: 'var(--color-primary-text)', ...softTint(true),
}
const secondaryChipRemove: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15,
  background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0,
}
// Reset — FILTER-VLAK-1 step 2: downgraded from a bordered/tinted button to a
// small text item, since it now lives on the situational second row beside the
// active-filter chips instead of competing with them as a second big button.
const resetTextItem: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0,
  fontSize: 11.5, fontWeight: 600, color: 'var(--color-primary-text)',
  background: 'none', border: 'none', cursor: 'pointer',
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

// One primary-field trigger: the field's own label lives INSIDE the button
// ("Vacaturestatus · 2"), mirroring the DrawerFilterMenu "More filters" idiom —
// FILTER-VLAK-1 step 1: this replaces the separate label-beside-control layout,
// halving the number of elements on the row.
function PrimaryFilterTrigger({ label, count }: { label: string; count: number }) {
  return (
    <span style={filterTrigger(count > 0)}>
      {label}
      {count > 0 && <span aria-hidden="true" style={filterTriggerBadge}>{count}</span>}
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
 * FILTER-VLAK-1 (Danny 13-08, rustplan approved, 4 steps): ONE fixed line at the
 * canon toolbar size (minHeight 36, gap 10) carries only the three trigger
 * buttons + the "More filters" popover — Status/Functie/Contractvorm no longer
 * get their own text label beside the control, the label now lives INSIDE the
 * trigger ("Vacaturestatus · 2"), same idiom the popover trigger already used.
 * Active secondary-filter chips + "Filters herstellen" move together onto a
 * SITUATIONAL second row that only renders while something is actually active —
 * herstellen is now a small text item, never a second full-size button.
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

  // Situational second row (step 2): only rendered once something is actually
  // active — the reset flag already covers radius/status/functions/contractvorm
  // too, so it is the row's own visibility condition; the hours/availableFrom
  // checks are additionally listed so a future filter that skips filtersDirty
  // (unlikely, but never silently swallowed) still surfaces its chip.
  const showSecondaryRow = filtersDirty || hoursActive || availableFromActive

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Fixed line, canon toolbar size (§4: minHeight 36, gap 10, centered, no
          background/divider) — step 1+2: only the three trigger buttons + "More
          filters" ever live here, so it never grows past one line. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, flexWrap: 'wrap' }}>
        <SearchSelect
          options={statusOptions.map(s => ({ value: s.value, label: s.label }))}
          selected={statuses} onToggle={v => onStatusesChange(toggle(statuses, v))}
          renderTrigger={toggleOpen => (
            <button type="button" onClick={toggleOpen} aria-label={t('vacancySearch.statuses')} style={{ background: 'none', border: 'none', padding: 0 }}>
              <PrimaryFilterTrigger label={t('vacancySearch.statuses')} count={statuses.length} />
            </button>
          )}
        />
        <div>
          <SearchSelect
            options={functionOptions} selected={functions} onToggle={v => onFunctionsChange(toggle(functions, v))}
            renderTrigger={toggleOpen => (
              <button type="button" onClick={toggleOpen} aria-label={t('vacancySearch.functions')} style={{ background: 'none', border: 'none', padding: 0 }}>
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
            <button type="button" onClick={toggleOpen} aria-label={t('vacancySearch.contractForm')} style={{ background: 'none', border: 'none', padding: 0 }}>
              <PrimaryFilterTrigger label={t('vacancySearch.contractForm')} count={contractvorm.length} />
            </button>
          )}
        />
        {/* P8-more-filters: "Uren per week" + "Inzetbaar vanaf" now live behind this
            popover — the shared DrawerFilterMenu, its 'range'/'date' rows added for
            this card. No-op (renders nothing) once neither is offered. */}
        <DrawerFilterMenu filters={moreFilters} label={t('vacancySearch.moreFilters')}
          title={t('vacancySearch.moreFiltersTitle')} clearAllLabel={t('common:filters.clearAll')} />
      </div>
      {/* Situational second row (step 2): active secondary chips + the reset text
          item, together, only while at least one filter narrows the search. */}
      {showSecondaryRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px 10px', flexWrap: 'wrap' }}>
          {hoursActive && (
            <SecondaryFilterChip label={t('vacancySearch.cardHours', { range: hoursValueLabel })}
              ariaLabel={t('vacancySearch.removeFilter', { label: t('vacancySearch.hoursPerWeek') })} onRemove={resetHours} />
          )}
          {availableFromActive && (
            <SecondaryFilterChip label={`${t('vacancySearch.availableFromFilter')}: ${formatDate(availableFrom)}`}
              ariaLabel={t('vacancySearch.removeFilter', { label: t('vacancySearch.availableFromFilter') })} onRemove={clearAvailableFrom} />
          )}
          {/* Reset (Danny 08-08, point 8) — only rendered when it would actually change
              something; a button that does nothing is noise. Step 2: a small text item
              now, pushed to the row's end via auto-margin. */}
          {filtersDirty && (
            <button type="button" onClick={onReset} style={{ ...resetTextItem, marginLeft: 'auto' }}>
              <RotateCcw size={12} aria-hidden="true" />
              {t('vacancySearch.resetFilters')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
