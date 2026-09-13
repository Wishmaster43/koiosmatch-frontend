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
import { Opt, archivedCheckboxGroup, trashCheckboxGroup, periodCreatedGroup } from '@/lib/filterGroups/common'
import { filterCategoryLabels } from '@/lib/filterGroups/categories'

type SetBucket = Dispatch<SetStateAction<string>>
type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => void

export type CvFilter = 'with' | 'without' | null

interface BuildArgs {
  t: TFunction
  tog: Tog
  filters: {
    // Bucket (Danny 14-08): the same single-value state the removed toolbar tab
    // row drove — one truth, now bound to the donut + this panel group.
    bucket: string; setBucket: SetBucket
    selectedPhase: string[]; setSelectedPhase: Dispatch<SetStateAction<string[]>>
    selectedOwner: string[]; setSelectedOwner: Dispatch<SetStateAction<string[]>>
    selectedSource: string[]; setSelectedSource: Dispatch<SetStateAction<string[]>>
    selectedVac: string[]; setSelectedVac: Dispatch<SetStateAction<string[]>>
    selectedClient: string[]; setSelectedClient: Dispatch<SetStateAction<string[]>>
    selectedBranch: string[]; setSelectedBranch: Dispatch<SetStateAction<string[]>>
    showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
    showTrash: boolean; setShowTrash: (fn: (v: boolean) => boolean) => void
    dateRange: AppDateRangeFilter | null; setDateRange: (v: AppDateRangeFilter | null) => void
    // APP-CV-AUTOMATION-1: single-value CV presence filter (with / without / any).
    cvFilter: CvFilter; setCvFilter: (v: CvFilter) => void
  }
  options: {
    bucketOptions: Opt[]; phaseOptions: Opt[]; ownerOptions: Opt[]; sourceOptions: Opt[]
    vacOptions: Opt[]; clientOptions: Opt[]; branchOptions: Opt[]
  }
}

// Pure builder: composes the application filter panel's category groups
// (Werving/lifecycle · Organisatie · Weergave — mirrors the candidate axes).
export function buildApplicationFilterGroups({ t, tog, filters: f, options: o }: BuildArgs) {
  const catLifecycle = t('filters.categories.lifecycle')
  const { catOrg, catDisplay } = filterCategoryLabels(t)

  // Bucket — single-value dimension (never multi, unlike the tog() groups below):
  // picking a slice REPLACES the current bucket; picking the active one again
  // returns to the default 'active' (mirrors the donut's pickBucket behaviour,
  // see applicationInsights.ts).
  const onToggleBucket = (v: string) => { f.setShowArchived(() => false); f.setBucket(prev => (prev === v ? 'active' : v)) }

  return [
    { key: 'bucket',  type: 'search-select', category: catLifecycle, label: t('insights.bucket'), selected: f.bucket === 'active' ? [] : [f.bucket], options: o.bucketOptions, onToggle: onToggleBucket },
    { key: 'phase',   type: 'search-select', category: catLifecycle, label: t('insights.phase'),  selected: f.selectedPhase,  options: o.phaseOptions,  onToggle: tog(f.setSelectedPhase) },
    // APP-CV-AUTOMATION-1 (BE bundle MISC Lane B): CV presence — single value like the
    // bucket (picking the active one again clears it); server `?has_cv=1|0`, row `hasCv`.
    { key: 'cv', type: 'search-select', category: catLifecycle, label: t('filters.cv.label'), selected: f.cvFilter ? [f.cvFilter] : [],
      options: [{ value: 'with', label: t('filters.cv.with') }, { value: 'without', label: t('filters.cv.without') }],
      onToggle: (v: string) => f.setCvFilter(f.cvFilter === v ? null : (v as CvFilter)) },
    { key: 'owner',   type: 'search-select', category: catOrg,       label: t('insights.owner'),  selected: f.selectedOwner,  options: o.ownerOptions,  onToggle: tog(f.setSelectedOwner) },
    { key: 'source',  type: 'search-select', category: catOrg,       label: t('insights.source'), selected: f.selectedSource, options: o.sourceOptions, onToggle: tog(f.setSelectedSource) },
    { key: 'vacancy', type: 'search-select', category: catOrg,       label: t('cols.vacancy'),    selected: f.selectedVac,    options: o.vacOptions,    onToggle: tog(f.setSelectedVac) },
    { key: 'client',  type: 'search-select', category: catOrg,       label: t('cols.client'),     selected: f.selectedClient, options: o.clientOptions, onToggle: tog(f.setSelectedClient) },
    // VESTIGING-2: inherited from the candidate; values limited to the user's own
    // branch scope — never a widening.
    // DRY: owner+branch search-select shape matches customerFilterGroups' pair, but
    // here they are not adjacent (source/vacancy/client sit between them in this
    // panel's category order) — extracting a shared builder would force a reorder
    // of the rendered filter panel (SCHERMWAARHEID: render must stay byte-identical),
    // so the two-line duplication is kept as the safer, render-preserving choice.
    { key: 'branch',  type: 'search-select', category: catOrg,       label: t('common:filters.branch'), selected: f.selectedBranch, options: o.branchOptions, onToggle: tog(f.setSelectedBranch) },
    // Archived + trash mirrors (quick-view toggles share one server flag include_archived).
    archivedCheckboxGroup(t, catDisplay, f.showArchived, f.setShowArchived, 'archived.toggle'),
    trashCheckboxGroup(t, catDisplay, f.showTrash, f.setShowTrash),
    // Period group (date range from a dashboard bar click).
    ...periodCreatedGroup(t, catDisplay, f.dateRange, f.setDateRange),
  ]
}
