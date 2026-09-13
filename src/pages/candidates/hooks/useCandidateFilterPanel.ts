/**
 * useCandidateFilterPanel — owns the click-to-filter helpers (chart clicks →
 * exactly-one-value toggles), the blacklist quick-view derivation, and the
 * right-panel filter-group registration (§0.3 split: CandidatesPage grew past
 * 400 lines). Pulled out as its own hook because it is pure UI-state glue that
 * does not belong in the data/options hooks.
 */
import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useRightPanel } from '@/context/RightPanelContext'
import { toggleOneValue } from '../data/candidatesShared'
import { buildCandidateFilterGroups } from '../data/candidateFilterGroups'
import type { GeoFilter, DateRangeFilter } from './useCandidateFilters'
import type { Opt } from '@/lib/filterGroups/common'
import type { LookupItem } from '@/context/LookupsContext'

interface UseCandidateFilterPanelArgs {
  t: (k: string) => string
  statuses: LookupItem[]
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedPhase: string[]; setSelectedPhase: Dispatch<SetStateAction<string[]>>
  selectedFunnel: string[]; setSelectedFunnel: Dispatch<SetStateAction<string[]>>
  selectedType: string[]; setSelectedType: Dispatch<SetStateAction<string[]>>
  selectedTitle: string[]; setSelectedTitle: Dispatch<SetStateAction<string[]>>
  selectedPool: string[]; setSelectedPool: Dispatch<SetStateAction<string[]>>
  selectedCity: string[]; setSelectedCity: Dispatch<SetStateAction<string[]>>
  selectedProvince: string[]; setSelectedProvince: Dispatch<SetStateAction<string[]>>
  selectedGeslacht: string[]; setSelectedGeslacht: Dispatch<SetStateAction<string[]>>
  selectedOwner: Array<string | number>; setSelectedOwner: Dispatch<SetStateAction<Array<string | number>>>
  selectedLocation: Array<string | number>; setSelectedLocation: Dispatch<SetStateAction<Array<string | number>>>
  selectedSource: string[]; setSelectedSource: Dispatch<SetStateAction<string[]>>
  showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
  missingAppointmentFilter: boolean; setMissingAppointmentFilter: (fn: (v: boolean) => boolean) => void
  attentionFilter: string | null; setAttentionFilter: Dispatch<SetStateAction<string | null>>
  dateRange: DateRangeFilter | null; setDateRange: (v: DateRangeFilter | null) => void
  geoFilter: GeoFilter | null; geoHint: string | null
  applyGeo: (q: string, km: number) => void; clearGeo: () => void
  statusOptions: Opt[]; phaseOptions: Opt[]; funnelOptions: Opt[]; typeOptions: Opt[]; titleOptions: Opt[]
  poolOptions: Opt[]; cityOptions: Opt[]; provinceOptions: Opt[]; genderOptions: Opt[]; ownerOptions: Opt[]
  locationOptions: Opt[]; sourceOptions: Opt[]
}

// Click-on-chart → sets exactly one value, or clears it on a second click (toggle).
function pickOneFactory<T>(set: Dispatch<SetStateAction<T[]>>) {
  return (v: T | null | undefined) => { if (v != null) toggleOneValue(set, v) }
}

export function useCandidateFilterPanel(args: UseCandidateFilterPanelArgs) {
  const {
    t, statuses, setSelectedStatus, setSelectedPhase, setSelectedFunnel, setSelectedOwner,
    setAttentionFilter,
    showArchived, setShowArchived, missingAppointmentFilter, setMissingAppointmentFilter,
    attentionFilter, dateRange, setDateRange, geoFilter, geoHint, applyGeo, clearGeo,
    selectedStatus, selectedPhase, selectedFunnel, selectedType, setSelectedType,
    selectedTitle, setSelectedTitle, selectedGeslacht, setSelectedGeslacht,
    selectedProvince, setSelectedProvince, selectedOwner, selectedLocation, setSelectedLocation,
    selectedPool, setSelectedPool, selectedCity, setSelectedCity, selectedSource, setSelectedSource,
    poolOptions, cityOptions, sourceOptions,
    statusOptions, phaseOptions, funnelOptions, typeOptions, titleOptions, genderOptions,
    provinceOptions, ownerOptions, locationOptions,
  } = args
  const { registerFilters, unregisterFilters } = useRightPanel() as { registerFilters: (id: string, groups: unknown) => void; unregisterFilters: (id: string) => void }

  // Generic multi-value toggle (add/remove from an array filter) — closes over nothing render-scoped.
  const tog = <T,>(set: Dispatch<SetStateAction<T[]>>) => (v: T) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const pickStatus = pickOneFactory(setSelectedStatus)
  const pickPhase  = pickOneFactory(setSelectedPhase)
  const pickFunnel = pickOneFactory(setSelectedFunnel)
  const pickOwner  = pickOneFactory(setSelectedOwner)
  const toggleAttention = (key: string) => setAttentionFilter(prev => prev === key ? null : key)

  // Blacklist quick-view: the blacklist status is flag-driven (§3B: is_blacklist), never a
  // hardcoded value key. Set/clear the status filter to just that value.
  const blacklistValue = statuses.find(s => s.is_blacklist)?.value ?? 'blacklist'
  const blacklistActive = selectedStatus.length === 1 && selectedStatus[0] === blacklistValue
  const toggleBlacklist = () => setSelectedStatus(blacklistActive ? [] : [blacklistValue])

  // Panel groups are config built by a pure helper (§0.3 size split) — the memo
  // only re-runs when a selection or option list actually changes.
  const filterGroups = useMemo(() => buildCandidateFilterGroups({
    t, tog, filters: {
      selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedFunnel, setSelectedFunnel,
      selectedType, setSelectedType, selectedTitle, setSelectedTitle,
      selectedPool, setSelectedPool, selectedCity, setSelectedCity,
      selectedProvince, setSelectedProvince, selectedGeslacht, setSelectedGeslacht,
      selectedOwner, setSelectedOwner, selectedLocation, setSelectedLocation,
      selectedSource, setSelectedSource,
      showArchived, setShowArchived, missingAppointmentFilter, setMissingAppointmentFilter, attentionFilter, setAttentionFilter, dateRange, setDateRange,
      geoFilter, geoHint, applyGeo, clearGeo,
    },
    options: { statusOptions, phaseOptions, funnelOptions, typeOptions, titleOptions, poolOptions, cityOptions,
      provinceOptions, genderOptions, ownerOptions, locationOptions, sourceOptions },
  }),
  // Complete dep array (CANDPAGE-DISABLE-REASON-1, mirrors CustomersPage/VacanciesPage):
  // every setSelectedX/setShowArchived/setDateRange/… is a usePageMemory/useState
  // setter — React-stable for the component's lifetime — and applyGeo/clearGeo are
  // useCallback-wrapped in useCandidateFilters, so none of these ever change
  // identity; only the actual selections/options/`t` drive a recompute. `tog` is
  // intentionally omitted — it closes over nothing from render scope (same as the
  // customers/vacancies `tog`), so its identity is irrelevant to the memo's output.
  [t, showArchived, setShowArchived, missingAppointmentFilter, setMissingAppointmentFilter, attentionFilter, setAttentionFilter, dateRange, setDateRange, geoFilter, geoHint, applyGeo, clearGeo,
   selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedFunnel, setSelectedFunnel,
   selectedType, setSelectedType, selectedTitle, setSelectedTitle, selectedGeslacht, setSelectedGeslacht,
   selectedProvince, setSelectedProvince, selectedOwner, setSelectedOwner, selectedLocation, setSelectedLocation,
   selectedPool, setSelectedPool, selectedCity, setSelectedCity, selectedSource, setSelectedSource,
   poolOptions, cityOptions, sourceOptions,
   statusOptions, phaseOptions, funnelOptions, typeOptions, titleOptions, genderOptions, provinceOptions, ownerOptions, locationOptions])

  // Registers this page's filter groups with the shared right panel, and unregisters them on unmount so they do not leak into another page filter list.
  useEffect(() => {
    registerFilters('candidates-page', filterGroups)
    return () => unregisterFilters('candidates-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  return { pickStatus, pickPhase, pickFunnel, pickOwner, toggleAttention, blacklistValue, blacklistActive, toggleBlacklist }
}
