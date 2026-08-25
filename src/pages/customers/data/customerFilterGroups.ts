/**
 * buildCustomerFilterGroups — the right-panel filter config for the customers
 * page. Pure function (§0.3 size split): state + options come in, group config
 * goes out — mirrors buildCandidateFilterGroups/buildTaskFilterGroups.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { ddmmyyyy } from '@/lib/localDate'
import { NO_STATUS_KEY } from './customerInsights'

interface Opt { value?: string | number; label?: string; count?: number; color?: string }
type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => void

// DD-MM-YYYY (DATUM-1) for the period-chip label; echoes the input if unparseable.
// `ddmmyyyy` comes from lib/localDate, the init-free module (§0/DATUM-1) — this is a
// pure module and must not drag in lib/datetime's i18n import.
const fmtD = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : ddmmyyyy(d) }

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
  const catGeneral = t('filters.categories.general')
  const catOrg      = t('filters.categories.organisation')
  const catDisplay  = t('filters.categories.display')

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
    { key: 'owner',    type: 'search-select', category: catOrg, label: t('filters.accountManager'), selected: f.selectedOwner,  options: o.ownerOptions,  onToggle: tog(f.setSelectedOwner) },
    { key: 'branch',   type: 'search-select', category: catOrg, label: t('common:filters.branch'),  selected: f.selectedBranch, options: o.branchOptions, onToggle: tog(f.setSelectedBranch) },
    // Archived mirrors the quick-view toggle; both share the showArchived state.
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('filters.archived'), selected: f.showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('page.archivedView') }], onToggle: () => f.setShowArchived(v => !v) },
    // Period (created date range) from a dashboard bar click — a single removable value.
    ...(f.dateRange ? [{
      key: 'period', type: 'search-select', category: catDisplay,
      label: t('filters.periodCreated'),
      selected: [`${f.dateRange.from}|${f.dateRange.to}`],
      options: [{ value: `${f.dateRange.from}|${f.dateRange.to}`, label: `${fmtD(f.dateRange.from)} – ${fmtD(f.dateRange.to)}` }],
      onToggle: () => f.setDateRange(null),
    }] : []),
  ]
}
