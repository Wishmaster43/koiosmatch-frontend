/**
 * useCustomersFilterPanel — builds the customer page's server-side filter
 * option lists and the right-hand filter-panel config, and registers it into
 * the shared RightPanelContext. Pure extraction from CustomersPage (§0.3
 * split) — no behavior change.
 */
import { useMemo, useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { geocodeNL } from '@/lib/geocode'
import { buildCustomerStatusOptions } from '../data/customerInsights'
import { buildCustomerFilterGroups } from '../data/customerFilterGroups'
import type { CustomerDateRange } from '../data/customerFilterGroups'
import type { PageStats } from './useCustomersData'
import type { FilterGroup } from '@/context/RightPanelContext'
import type { BranchOption } from '@/lib/useBranchOptions'
import type { Customer } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

export interface Opt { value: Id; label: string; count: number }

interface FilterState {
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedPhase: string[]; setSelectedPhase: Dispatch<SetStateAction<string[]>>
  selectedOwner: string[]; setSelectedOwner: Dispatch<SetStateAction<string[]>>
  selectedCity: string[]; setSelectedCity: Dispatch<SetStateAction<string[]>>
  selectedProvince: string[]; setSelectedProvince: Dispatch<SetStateAction<string[]>>
  selectedIndustry: string[]; setSelectedIndustry: Dispatch<SetStateAction<string[]>>
  selectedBranch: string[]; setSelectedBranch: Dispatch<SetStateAction<string[]>>
  showArchived: boolean; setShowArchived: Dispatch<SetStateAction<boolean>>
  dateRange: CustomerDateRange | null; setDateRange: Dispatch<SetStateAction<CustomerDateRange | null>>
  geoFilter: { q: string; km: number; lat: number; lng: number; label: string } | null
  setGeoFilter: Dispatch<SetStateAction<{ q: string; km: number; lat: number; lng: number; label: string } | null>>
  geoHint: string | null
  setGeoHint: Dispatch<SetStateAction<string | null>>
  setMapCenter: Dispatch<SetStateAction<{ lat: number; lng: number }>>
  setMapRadius: Dispatch<SetStateAction<number>>
}

interface Params {
  t: TFunction
  registerFilters: (key: string, groups: FilterGroup[]) => void
  unregisterFilters: (key: string) => void
  stats: PageStats | null | undefined
  customers: Customer[]
  statuses: LookupOption[]
  customerPhases: Array<{ value: string; label: string; color?: string; isDefault?: boolean }>
  entryPhase: { value: string; label: string; color?: string; isDefault?: boolean } | undefined
  entryPhaseValue: string | undefined
  branchOptions: BranchOption[]
  filters: FilterState
}

// Option lists (stats first, page-derived as fallback) + the right-panel filter groups — mirrors buildCandidateFilterGroups.
export function useCustomersFilterPanel({
  t, registerFilters, unregisterFilters, stats, customers, statuses, customerPhases, entryPhase, entryPhaseValue,
  branchOptions, filters,
}: Params) {
  const {
    selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner,
    selectedCity, setSelectedCity, selectedProvince, setSelectedProvince, selectedIndustry, setSelectedIndustry,
    selectedBranch, setSelectedBranch, showArchived, setShowArchived, dateRange, setDateRange,
    geoFilter, setGeoFilter, geoHint, setGeoHint, setMapCenter, setMapRadius,
  } = filters

  const optsFrom = (values: string[]): Opt[] => {
    const counts: Record<string, number> = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    return Object.keys(counts).map(v => ({ value: v, label: v, count: counts[v] }))
  }
  // Danny 02-08: the status donut must stop counting Prospect as a status — the
  // '__none' bucket (buildCustomerStatusOptions, mirrors the candidate Lead
  // bucket) keys on the PHASE, never the (retiring) customer_statuses 'prospect'
  // value, so nothing here needs to change once the backend finishes removing it.
  const statusOptions = useMemo(() =>
    buildCustomerStatusOptions({
      statsByStatus: stats?.by_status, customers, statuses, entryPhase, entryPhaseValue,
      noStatusFallbackLabel: t('insights.noStatus'),
    })
  , [stats, customers, statuses, entryPhase, entryPhaseValue, t])
  const ownerOptions = useMemo<Opt[]>(() => {
    if (stats?.by_owner) return stats.by_owner.map(o => ({ value: (o.id ?? o.owner_id ?? '') as Id, label: o.name || '—', count: o.count ?? 0 })).filter(o => o.value !== '')
    const m: Record<string, Opt> = {}
    customers.forEach(c => { if (c.ownerId != null) { const key = String(c.ownerId); (m[key] ??= { value: c.ownerId as Id, label: c.owner || '—', count: 0 }).count++ } })
    return Object.values(m)
  }, [stats, customers])
  // Distinct city values from the current page, used as a fallback filter option list.
  const cityOptions     = useMemo(() => optsFrom(customers.map(c => c.city).filter(Boolean)), [customers])
  // Distinct province (state) values from the current page, used as a fallback filter option list.
  const provinceOptions = useMemo(() => optsFrom(customers.map(c => c.state).filter(Boolean)), [customers])
  // Distinct industry values from the current page, used as a fallback filter option list.
  const industryOptions = useMemo(() => optsFrom(customers.map(c => c.industry).filter(Boolean)), [customers])
  const phaseOptions = useMemo<Opt[]>(() => customerPhases.map(p => ({ value: p.value, label: p.label, count: 0, color: p.color })), [customerPhases])

  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  // Straal-blok apply: PDOK-geocode; found → filter + map sync, not found → hint.
  // Stabilized (useCallback) so the filterGroups useMemo below can safely depend
  // on it — every captured setter is itself stable, only `t` can genuinely change.
  const applyGeo = useCallback(async (q: string, km: number) => {
    setGeoHint(null)
    const hit = await geocodeNL(q)
    if (!hit) { setGeoHint(t('common:filters.notFound')); return }
    setGeoFilter({ q, km, lat: hit.lat, lng: hit.lng, label: `${hit.label} · ${km} km` })
    setMapCenter({ lat: hit.lat, lng: hit.lng }); setMapRadius(km)
  }, [t, setGeoHint, setGeoFilter, setMapCenter, setMapRadius])

  // Filter panel config lives in the data/ builder (mirrors buildCandidateFilterGroups).
  const filterGroups = useMemo(() => buildCustomerFilterGroups({
    t, tog,
    filters: {
      selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase,
      selectedIndustry, setSelectedIndustry, selectedCity, setSelectedCity,
      selectedProvince, setSelectedProvince, selectedOwner, setSelectedOwner,
      selectedBranch, setSelectedBranch, showArchived, setShowArchived,
      dateRange, setDateRange, geoFilter, geoHint, applyGeo,
      clearGeo: () => { setGeoFilter(null); setGeoHint(null) },
    },
    options: { statusOptions, phaseOptions, industryOptions, cityOptions, provinceOptions, ownerOptions, branchOptions },
  }), [t, selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedIndustry, setSelectedIndustry,
      selectedCity, setSelectedCity, selectedProvince, setSelectedProvince, selectedOwner, setSelectedOwner,
      selectedBranch, setSelectedBranch, showArchived, setShowArchived, dateRange, setDateRange,
      geoFilter, geoHint, applyGeo, setGeoFilter, setGeoHint, statusOptions, phaseOptions, industryOptions, cityOptions,
      provinceOptions, ownerOptions, branchOptions])

  // Registers the page's filter groups into the shared right-hand panel and cleans up on unmount/change.
  useEffect(() => {
    registerFilters('customers-page', filterGroups)
    return () => unregisterFilters('customers-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  return { statusOptions, ownerOptions, applyGeo }
}
