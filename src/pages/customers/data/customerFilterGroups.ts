/**
 * buildCustomerFilterGroups — the right-panel filter config for the customers
 * page. Pure function (§0.3 size split): state + options come in, group config
 * goes out — mirrors buildCandidateFilterGroups/buildTaskFilterGroups.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { NO_STATUS_KEY } from './customerInsights'
import { Opt, Tog, archivedCheckboxGroup, periodCreatedGroup } from '@/lib/filterGroups/common'
import { filterCategoryLabels } from '@/lib/filterGroups/categories'

export interface CustomerDateRange { param: 'created_between'; from: string; to: string }
export interface CustomerGeoFilter { q: string; km: number; lat: number; lng: number; label: string }

interface BuildArgs {
  t: TFunction
  tog: Tog
  filters: {
    selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
    selectedPhase: string[]; setSelectedPhase: Dispatch<SetStateAction<string[]>>
    selectedIndustry: string[]; setSelectedIndustry: Dispatch<SetStateAction<string[]>>
    selectedCity: string[]; setSelectedCity: Dispatch<SetStateAction<string[]>>
    selectedProvince: string[]; setSelectedProvince: Dispatch<SetStateAction<string[]>>
    selectedOwner: string[]; setSelectedOwner: Dispatch<SetStateAction<string[]>>
    selectedBranch: string[]; setSelectedBranch: Dispatch<SetStateAction<string[]>>
    showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
    dateRange: CustomerDateRange | null; setDateRange: (v: CustomerDateRange | null) => void
    geoFilter: CustomerGeoFilter | null; geoHint: string | null
    applyGeo: (q: string, km: number) => void; clearGeo: () => void
  }
  options: {
    statusOptions: Opt[]; phaseOptions: Opt[]; industryOptions: Opt[]
    cityOptions: Opt[]; provinceOptions: Opt[]; ownerOptions: Opt[]; branchOptions: Opt[]
  }
}

// Pure builder: composes the customer filter panel's category groups. Reads the
// candidate page's category shape (§3A) so the panel feels identical entity-to-entity.
export function buildCustomerFilterGroups({ t, tog, filters: f, options: o }: BuildArgs) {
  const { catGeneral, catOrg, catDisplay } = filterCategoryLabels(t)

  return [
    // The '__none' (entry-phase) bucket is donut-only — never a selectable status here.
    { key: 'status',   type: 'search-select', category: catGeneral, label: t('filters.status'),   selected: f.selectedStatus,   options: o.statusOptions.filter(x => x.value !== NO_STATUS_KEY), onToggle: tog(f.setSelectedStatus) },
    // KLANT-FASE-1: the lifecycle phase axis (prospect/customer), separate from status.
    { key: 'phase',    type: 'search-select', category: catGeneral, label: t('filters.phase'),    selected: f.selectedPhase,    options: o.phaseOptions,    onToggle: tog(f.setSelectedPhase) },
    { key: 'industry', type: 'search-select', category: catGeneral, label: t('filters.industry'), selected: f.selectedIndustry, options: o.industryOptions, onToggle: tog(f.setSelectedIndustry) },
    // City and province are two distinct address axes — kept as separate groups.
    { key: 'city',     type: 'search-select', category: catGeneral, label: t('filters.city'),     selected: f.selectedCity,     options: o.cityOptions,     onToggle: tog(f.setSelectedCity) },
    { key: 'province', type: 'search-select', category: catGeneral, label: t('filters.province'), selected: f.selectedProvince, options: o.provinceOptions, onToggle: tog(f.setSelectedProvince) },
    { key: 'geo', type: 'geo-radius', category: catGeneral, label: t('common:filters.radius'),
      applied: f.geoFilter ? { label: f.geoFilter.label } : null, hint: f.geoHint, km: f.geoFilter?.km ?? 30,
      onApply: f.applyGeo, onClear: f.clearGeo },
    // DRY: owner+branch search-select shape matches applicationFilterGroups' pair,
    // but there they are not adjacent (source/vacancy/client sit between them in
    // that panel's category order) — extracting a shared builder would force a
    // reorder of that rendered filter panel (SCHERMWAARHEID: render must stay
    // byte-identical), so the two-line duplication is kept here too.
    { key: 'owner',    type: 'search-select', category: catOrg, label: t('filters.accountManager'), selected: f.selectedOwner,  options: o.ownerOptions,  onToggle: tog(f.setSelectedOwner) },
    { key: 'branch',   type: 'search-select', category: catOrg, label: t('common:filters.branch'),  selected: f.selectedBranch, options: o.branchOptions, onToggle: tog(f.setSelectedBranch) },
    // Archived mirrors the quick-view toggle.
    archivedCheckboxGroup(t, catDisplay, f.showArchived, f.setShowArchived, 'page.archivedView'),
    // Period group (date range from a dashboard bar click).
    ...periodCreatedGroup(t, catDisplay, f.dateRange, f.setDateRange),
  ]
}
