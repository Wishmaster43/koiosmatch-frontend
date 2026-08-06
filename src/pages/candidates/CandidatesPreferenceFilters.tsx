/**
 * CandidatesPreferenceFilters — KAND-FILTERS-1: the "Voorkeuren" filter row for
 * the candidates list (contract form multi-select + hours-per-week range +
 * "available before" date). The shared right-panel filter groups
 * (components/reports/filter/FilterGroupBlock) only support search-select /
 * date-range(from+to) / checkbox / radio — none of which fit a free-typed
 * number pair or a single bound date — so this mirrors the OTHER established
 * idiom already in the codebase for exactly this shape: VacancySearchTab's
 * "plain input in a filter row" (SearchSelect + number inputs + a date input),
 * kept as its own thin, dumb component (§3) that CandidatesPage wires with
 * local state and merges into the server filterParams.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import type { LookupItem } from '@/context/LookupsContext'

// Mirrors ChangelogTab/VacancySearchTab's established "plain input in a filter
// row" look (§11 — no second copy of this exact style pair, only reused here).
const filterLabel: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const filterInput: CSSProperties = { padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }

interface CandidatesPreferenceFiltersProps {
  contractTypeOptions: LookupItem[]
  selectedContractTypes: string[]
  onToggleContractType: (value: string) => void
  hoursMin: string
  onHoursMinChange: (value: string) => void
  hoursMax: string
  onHoursMaxChange: (value: string) => void
  availableFromBefore: string
  onAvailableFromBeforeChange: (value: string) => void
}

export default function CandidatesPreferenceFilters({
  contractTypeOptions, selectedContractTypes, onToggleContractType,
  hoursMin, onHoursMinChange, hoursMax, onHoursMaxChange,
  availableFromBefore, onAvailableFromBeforeChange,
}: CandidatesPreferenceFiltersProps) {
  const { t } = useTranslation(['candidates', 'common'])

  // Trigger text mirrors the shared filter-panel idiom (SearchSelectGroup / report
  // filters / VacancySearchTab) — a count once something is selected, else a prompt.
  const contractTypeLabel = t('filters.preferences.contractTypes')
  const triggerText = selectedContractTypes.length > 0
    ? t('common:filters.selectedCount', { count: selectedContractTypes.length })
    : t('common:filters.choose', { label: contractTypeLabel.toLowerCase() })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16,
      padding: '10px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <span style={{ ...filterLabel, marginBottom: 0, alignSelf: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {t('filters.preferences.title')}
      </span>

      {/* Contract form — multi-select, same candidateTypes lookup as the werving-axis
          type filter, sent under its own contract_types[] param (BE: KAND-FILTERS-1). */}
      <div style={{ minWidth: 180 }}>
        <span style={filterLabel}>{contractTypeLabel}</span>
        <SearchSelect
          options={contractTypeOptions.map(ct => ({ value: ct.value, label: ct.label }))}
          selected={selectedContractTypes} onToggle={onToggleContractType}
          triggerLabel={triggerText}
        />
      </div>

      {/* Hours-per-week range — plain number inputs, AND-combined min/max bounds. */}
      <div style={{ minWidth: 150 }}>
        <span style={filterLabel}>{t('filters.preferences.hoursPerWeek')}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" min={0} value={hoursMin} onChange={e => onHoursMinChange(e.target.value)}
            placeholder={t('filters.preferences.hoursMinPlaceholder')}
            aria-label={`${t('filters.preferences.hoursPerWeek')} ${t('filters.preferences.hoursMinPlaceholder')}`}
            style={{ ...filterInput, width: 68 }} />
          <input type="number" min={0} value={hoursMax} onChange={e => onHoursMaxChange(e.target.value)}
            placeholder={t('filters.preferences.hoursMaxPlaceholder')}
            aria-label={`${t('filters.preferences.hoursPerWeek')} ${t('filters.preferences.hoursMaxPlaceholder')}`}
            style={{ ...filterInput, width: 68 }} />
        </div>
      </div>

      {/* Available-before — a single upper bound on candidate_preferences.available_from. */}
      <div style={{ minWidth: 170 }}>
        <span style={filterLabel}>{t('filters.preferences.availableFromBefore')}</span>
        <input type="date" value={availableFromBefore} onChange={e => onAvailableFromBeforeChange(e.target.value)}
          aria-label={t('filters.preferences.availableFromBefore')} style={filterInput} />
      </div>
    </div>
  )
}
