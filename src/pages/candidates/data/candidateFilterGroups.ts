/**
 * buildCandidateFilterGroups — the right-panel filter config for the candidates
 * page (§3B axes: Werving · Kwalificaties · Persoon · Organisatie · Weergave).
 * Pure function (§0.3 size split): state + options come in, group config goes out.
 * Small fixed lookups render as OPEN checkbox lists; long lists stay dropdowns.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { GeoFilter, DateRangeFilter } from '../hooks/useCandidateFilters'

// Option rows arrive from several stats feeds — value/label may be undefined on
// malformed rows; the panel renders them defensively, so keep the type loose.
interface Opt { value?: string | number; label?: string; count?: number; color?: string }
type Tog = <T,>(set: Dispatch<SetStateAction<T[]>>) => (v: T) => void

// DD-MM-YYYY (nl) for the period-chip label; echoes the input if unparseable.
const fmtD = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('nl-NL') }

interface BuildArgs {
  t: (k: string, o?: Record<string, unknown>) => string
  tog: Tog
  filters: {
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
    dateRange: DateRangeFilter | null; setDateRange: (v: DateRangeFilter | null) => void
    geoFilter: GeoFilter | null; geoHint: string | null
    applyGeo: (q: string, km: number) => void; clearGeo: () => void
  }
  options: Record<string, Opt[]>
}

export function buildCandidateFilterGroups({ t, tog, filters: f, options: o }: BuildArgs) {
  const catLifecycle      = t('filters.categories.lifecycle')
  const catQualifications = t('filters.categories.qualifications')
  const catPerson         = t('filters.categories.person')
  const catOrganisation   = t('filters.categories.organisation')
  const catDisplay        = t('filters.categories.display')

  return [
    // ── Werving: the recruiting axes (status/funnel/contract form) — open lists.
    { key: 'status', type: 'search-select', display: 'open', category: catLifecycle, label: t('filters.status'),        selected: f.selectedStatus, options: o.statusOptions, onToggle: tog(f.setSelectedStatus) },
    // Fase (lifecycle axis) — server filter phase[] (PHASE-FILTER-1).
    { key: 'phase',  type: 'search-select', display: 'open', category: catLifecycle, label: t('filters.phase'),         selected: f.selectedPhase,  options: o.phaseOptions,  onToggle: tog(f.setSelectedPhase) },
    { key: 'funnel', type: 'search-select', display: 'open', category: catLifecycle, label: t('filters.funnelType'),    selected: f.selectedFunnel, options: o.funnelOptions, onToggle: tog(f.setSelectedFunnel) },
    { key: 'type',   type: 'search-select', display: 'open', category: catLifecycle, label: t('filters.candidateType'), selected: f.selectedType,   options: o.typeOptions,   onToggle: tog(f.setSelectedType) },
    // ── Kwalificaties: function + pools.
    { key: 'title',  type: 'search-select', category: catQualifications, label: t('filters.function'), selected: f.selectedTitle, options: o.titleOptions, onToggle: tog(f.setSelectedTitle) },
    ...(o.poolOptions.length   ? [{ key: 'pool',   type: 'search-select', category: catQualifications, label: t('filters.pool'),   selected: f.selectedPool,   options: o.poolOptions,   onToggle: tog(f.setSelectedPool) }] : []),
    // ── Persoon: WHERE (straal/plaats/provincie) + who.
    { key: 'geo', type: 'geo-radius', category: catPerson, label: t('common:filters.radius'),
      applied: f.geoFilter ? { label: f.geoFilter.label } : null, hint: f.geoHint, km: f.geoFilter?.km ?? 30,
      onApply: f.applyGeo, onClear: f.clearGeo },
    ...(o.cityOptions.length   ? [{ key: 'city',   type: 'search-select', category: catPerson,         label: t('filters.city'),   selected: f.selectedCity,   options: o.cityOptions,   onToggle: tog(f.setSelectedCity) }] : []),
    { key: 'province', type: 'search-select', category: catPerson, label: t('filters.province'), selected: f.selectedProvince, options: o.provinceOptions, onToggle: tog(f.setSelectedProvince) },
    { key: 'gender',   type: 'search-select', display: 'open', category: catPerson, label: t('filters.gender'),   selected: f.selectedGeslacht, options: o.genderOptions,   onToggle: tog(f.setSelectedGeslacht) },
    // ── Organisatie: owner/branch/source.
    { key: 'owner',    type: 'search-select', category: catOrganisation, label: t('filters.owner'),  selected: f.selectedOwner,    options: o.ownerOptions,    onToggle: tog(f.setSelectedOwner) },
    { key: 'location', type: 'search-select', category: catOrganisation, label: t('filters.branch'), selected: f.selectedLocation, options: o.locationOptions, onToggle: tog(f.setSelectedLocation) },
    ...(o.sourceOptions.length ? [{ key: 'source', type: 'search-select', category: catOrganisation,   label: t('filters.source'), selected: f.selectedSource, options: o.sourceOptions, onToggle: tog(f.setSelectedSource) }] : []),
    // ── Weergave: archived + period (view-scoping, not recruiting data).
    // Archived mirrors the quick-view toggle; both share the showArchived state.
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('filters.archived'), selected: f.showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('page.archivedView') }], onToggle: () => f.setShowArchived(v => !v) },
    // Period (date range) from a dashboard bar click — a single removable value.
    ...(f.dateRange ? [{
      key: 'period', type: 'search-select', category: catDisplay,
      label: t(f.dateRange.param === 'created_between' ? 'filters.periodCreated' : 'filters.periodLastContact'),
      selected: [`${f.dateRange.from}|${f.dateRange.to}`],
      options: [{ value: `${f.dateRange.from}|${f.dateRange.to}`, label: `${fmtD(f.dateRange.from)} – ${fmtD(f.dateRange.to)}` }],
      onToggle: () => f.setDateRange(null),
    }] : []),
  ]
}
