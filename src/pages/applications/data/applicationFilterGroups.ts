/**
 * buildApplicationFilterGroups — the right-panel filter config for the
 * applications page. Pure function (§0.3 size split): state + options come in,
 * group config goes out — mirrors buildCandidateFilterGroups/buildCustomerFilterGroups.
 * Groups now carry a `type`/`category` like every other entity's panel (they
 * used to fall back to the default search-select with no category header).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { AppDateRangeFilter } from '../hooks/useApplicationFilters'

interface Opt { value?: string | number; label?: string; count?: number; color?: string }
type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => void

// DD-MM-YYYY (nl) for the period-chip label; echoes the input if unparseable (DATUM-1).
const fmtD = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('nl-NL') }

interface BuildArgs {
  t: TFunction
  tog: Tog
  filters: {
    selectedPhase: string[]; setSelectedPhase: Dispatch<SetStateAction<string[]>>
    selectedOwner: string[]; setSelectedOwner: Dispatch<SetStateAction<string[]>>
    selectedSource: string[]; setSelectedSource: Dispatch<SetStateAction<string[]>>
    selectedVac: string[]; setSelectedVac: Dispatch<SetStateAction<string[]>>
    selectedClient: string[]; setSelectedClient: Dispatch<SetStateAction<string[]>>
    selectedBranch: string[]; setSelectedBranch: Dispatch<SetStateAction<string[]>>
    showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
    showTrash: boolean; setShowTrash: (fn: (v: boolean) => boolean) => void
    dateRange: AppDateRangeFilter | null; setDateRange: (v: AppDateRangeFilter | null) => void
  }
  options: {
    phaseOptions: Opt[]; ownerOptions: Opt[]; sourceOptions: Opt[]
    vacOptions: Opt[]; clientOptions: Opt[]; branchOptions: Opt[]
  }
}

// Pure builder: composes the application filter panel's category groups
// (Werving/lifecycle · Organisatie · Weergave — mirrors the candidate axes).
export function buildApplicationFilterGroups({ t, tog, filters: f, options: o }: BuildArgs) {
  const catLifecycle = t('filters.categories.lifecycle')
  const catOrg        = t('filters.categories.organisation')
  const catDisplay     = t('filters.categories.display')

  return [
    { key: 'phase',   type: 'search-select', category: catLifecycle, label: t('insights.phase'),  selected: f.selectedPhase,  options: o.phaseOptions,  onToggle: tog(f.setSelectedPhase) },
    { key: 'owner',   type: 'search-select', category: catOrg,       label: t('insights.owner'),  selected: f.selectedOwner,  options: o.ownerOptions,  onToggle: tog(f.setSelectedOwner) },
    { key: 'source',  type: 'search-select', category: catOrg,       label: t('insights.source'), selected: f.selectedSource, options: o.sourceOptions, onToggle: tog(f.setSelectedSource) },
    { key: 'vacancy', type: 'search-select', category: catOrg,       label: t('cols.vacancy'),    selected: f.selectedVac,    options: o.vacOptions,    onToggle: tog(f.setSelectedVac) },
    { key: 'client',  type: 'search-select', category: catOrg,       label: t('cols.client'),     selected: f.selectedClient, options: o.clientOptions, onToggle: tog(f.setSelectedClient) },
    // VESTIGING-2: inherited from the candidate; values limited to the user's own
    // branch scope — never a widening.
    { key: 'branch',  type: 'search-select', category: catOrg,       label: t('common:filters.branch'), selected: f.selectedBranch, options: o.branchOptions, onToggle: tog(f.setSelectedBranch) },
    // Archived + trash mirror the quick-view toggles — both share one server flag
    // (include_archived), two UI entry points (see useApplicationFilters).
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('archived.toggle'), selected: f.showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('archived.toggle') }], onToggle: () => f.setShowArchived(v => !v) },
    { key: 'trash',    type: 'checkbox', category: catDisplay, label: t('filters.trash'),  selected: f.showTrash ? ['trash'] : [],       options: [{ value: 'trash', label: t('filters.trash') }],     onToggle: () => f.setShowTrash(v => !v) },
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
