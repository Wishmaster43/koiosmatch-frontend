import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import DatePicker from 'react-datepicker'
import { RotateCcw } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import Slider from '@/components/ui/Slider'
import { parseDate } from '@/components/forms/fields'
import { toLocalIsoDate } from '@/lib/localDate'
import type { HoursRange } from '../hooks/vacancySearchFilters'

// Inline label — sits BESIDE its control instead of above it (Danny 09-08: a
// label-above-every-filter layout ran the bar over four lines with dead space).
const filterLabelInline: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }
// Bare filter-bar input (mirrors ChangelogTab's date-range inputStyle — the one
// established "plain input in a filter row" look, not the EditableFieldTable form field).
const filterInput: CSSProperties = { padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width: 128 }
// Reset trigger — a REAL button in the §4 soft-tint convention (tinted background,
// token text/icon, tinted border), never coloured text with an icon glued to it.
const resetButton: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
  fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
  color: 'var(--color-primary-text)',
  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
}
// Numeric readout of the hours range — JetBrains Mono per §4 (numbers/IDs).
const hoursReadout: CSSProperties = { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }

// One label-beside-control filter unit — replaces the old label-ABOVE block per
// filter. Every filter is now one line tall instead of two, and wraps as a
// single flex item instead of a fixed-width column with dead space around a
// narrower trigger button (the gap Danny pointed at right of Contractvorm).
function FilterField({ label, align = 'center', children }: { label: string; align?: CSSProperties['alignItems']; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: align, gap: 6 }}>
      <span style={filterLabelInline}>{label}</span>
      {children}
    </div>
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
 * COMPACT-1 (Danny 09-08): one continuous flex-wrap row, label BESIDE each
 * control instead of above it — the bar used to run four lines tall with dead
 * space around fixed-width columns; now every filter is a single-line unit that
 * wraps on its own, and the reset button lives in the same wrap flow.
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

  // Add/remove one value from a multi-select filter list.
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value]

  // Trigger text mirrors the shared filter-panel idiom (SearchSelectGroup / report
  // filters): a count once something is selected, else a calm "choose X" prompt.
  const triggerText = (selected: string[], label: string) =>
    selected.length > 0 ? t('common:filters.selectedCount', { count: selected.length }) : t('common:filters.choose', { label: label.toLowerCase() })

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
      {/* Uren-per-week range — ONE slider with two thumbs (Danny 08-08, point 8),
          gated (offered-iff-read) on the vacancy hours_min/hours_max fields. */}
      {hasHoursData && (
        <FilterField label={t('vacancySearch.hoursPerWeek')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 150 }}>
            <div style={{ flex: 1 }}>
              <Slider range={hoursRange} max={hoursRangeMax} step={1} onRangeChange={onHoursRangeChange}
                ariaLabels={[
                  `${t('vacancySearch.hoursPerWeek')} ${t('vacancySearch.hoursMinPlaceholder')}`,
                  `${t('vacancySearch.hoursPerWeek')} ${t('vacancySearch.hoursMaxPlaceholder')}`,
                ]} />
            </div>
            <span style={hoursReadout}>{t('vacancySearch.hoursRangeValue', { min: hoursRange[0], max: hoursRange[1] })}</span>
          </div>
        </FilterField>
      )}
      {/* Inzetbaar-vanaf date — gated the same way, on the vacancy start_date field.
          FIX (Danny 09-08): was a bare <input type="date"> — browser-native icon,
          non-NL date format and off-height. Now the shared react-datepicker convention
          (mirrors ProfilePersonalTab's dob field), DD-MM-YYYY, same filter-bar input look. */}
      {hasAvailableFromData && (
        <FilterField label={t('vacancySearch.availableFromFilter')}>
          <DatePicker
            selected={parseDate(availableFrom)}
            onChange={(d: Date | null) => onAvailableFromChange(d ? toLocalIsoDate(d) : '')}
            dateFormat="dd-MM-yyyy"
            showMonthDropdown showYearDropdown dropdownMode="select"
            placeholderText={t('vacancySearch.availableFromFilter')}
            portalId="datepicker-portal"
            popperPlacement="bottom-start"
            customInput={<input aria-label={t('vacancySearch.availableFromFilter')} style={filterInput} />}
          />
        </FilterField>
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
