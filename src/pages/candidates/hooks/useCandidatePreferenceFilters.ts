/**
 * useCandidatePreferenceFilters — KAND-FILTERS-1: the "Voorkeuren" filter
 * dimensions (contract form multi-select, hours-per-week min/max, an
 * "available before" upper bound) that sit ALONGSIDE useCandidateFilters
 * (a different job's owned file — this is a genuinely separate, newly-landed
 * axis, so it gets its own small hook rather than reaching into that one).
 * Merges into the base filterParams/anyFilterActive/clearAllFilters the page
 * already gets from useCandidateFilters, so every other filter on the page
 * keeps working unchanged — same shape, wider values (§0.3 size split, keeps
 * CandidatesPage a thin container).
 */
import { useMemo } from 'react'
import { usePageMemory } from '@/lib/usePageMemory'

interface UseCandidatePreferenceFiltersArgs {
  // The rest of the page's server params/active-filter signal/clear-all — this
  // hook widens them rather than replacing them.
  baseFilterParams: Record<string, unknown>
  baseAnyFilterActive: boolean
  baseClearAllFilters: () => void
}

export function useCandidatePreferenceFilters({
  baseFilterParams, baseAnyFilterActive, baseClearAllFilters,
}: UseCandidatePreferenceFiltersArgs) {
  // usePageMemory-backed (mirrors every other candidate filter): sticky across
  // navigation, cleared together with the rest via clearAllFilters below.
  const [selectedContractTypes, setSelectedContractTypes] = usePageMemory<string[]>('cand.contractTypes', [])
  const [hoursMin,              setHoursMin]              = usePageMemory('cand.hoursMin', '')
  const [hoursMax,              setHoursMax]              = usePageMemory('cand.hoursMax', '')
  const [availableFromBefore,   setAvailableFromBefore]   = usePageMemory('cand.availableFromBefore', '')

  // Multi-select toggle — same add/remove-from-array idiom as every other filter on this page.
  const toggleContractType = (v: string) =>
    setSelectedContractTypes(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]))

  // AND-combined with the base params — exact keys the backend validates
  // (CandidateQuery::rules — contract_types[]/hours_per_week_min/max/available_from_before).
  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = { ...baseFilterParams }
    if (selectedContractTypes.length) p.contract_types = selectedContractTypes
    if (hoursMin !== '' && Number.isFinite(Number(hoursMin))) p.hours_per_week_min = Number(hoursMin)
    if (hoursMax !== '' && Number.isFinite(Number(hoursMax))) p.hours_per_week_max = Number(hoursMax)
    if (availableFromBefore) p.available_from_before = availableFromBefore
    return p
  }, [baseFilterParams, selectedContractTypes, hoursMin, hoursMax, availableFromBefore])

  // "Clear filters"/active-dot widen to cover the Voorkeuren row too, so the
  // existing ClearFiltersButton (CandidatesToolbar, out of scope) stays correct
  // without needing to know these dimensions exist.
  const anyFilterActive = baseAnyFilterActive || selectedContractTypes.length > 0
    || hoursMin !== '' || hoursMax !== '' || Boolean(availableFromBefore)
  const clearAllFilters = () => {
    baseClearAllFilters()
    setSelectedContractTypes([]); setHoursMin(''); setHoursMax(''); setAvailableFromBefore('')
  }

  return {
    selectedContractTypes, toggleContractType,
    hoursMin, setHoursMin, hoursMax, setHoursMax,
    availableFromBefore, setAvailableFromBefore,
    filterParams, filterKey: JSON.stringify(filterParams),
    anyFilterActive, clearAllFilters,
  }
}
