/**
 * buildMatchFilterGroups — the right-panel filter config for the matches page
 * (stage/owner/client/branch/scored/date-range/archived). Pure function
 * (§0.3 size split): state + options come in, group config goes out — mirrors
 * buildTaskFilterGroups/buildCandidateFilterGroups. RIGHTPANEL-FILTERS-1
 * (2026-08-14): this is now the ONLY place stage/owner/client are filterable —
 * the toolbar's old MatchFilterBar (stage/owner triggers + a "more filters"
 * popover for client) was an exact duplicate and has been deleted.
 * i18n-scan: matches — pure builder receiving `t` as a param, so the keys-exist
 * guard needs this pragma to resolve the namespace and check the literals below.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'

interface Opt { value: string | number; label: string; count?: number }
type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string | number) => void

export interface MatchDateRange { from: string; to: string }

interface BuildArgs {
  t: TFunction
  tog: Tog
  stageFilter: string[]; setStageFilter: Dispatch<SetStateAction<string[]>>
  ownerFilter: string[]; setOwnerFilter: Dispatch<SetStateAction<string[]>>
  clientFilter: string[]; setClientFilter: Dispatch<SetStateAction<string[]>>
  branchFilter: string[]; setBranchFilter: Dispatch<SetStateAction<string[]>>
  // MATCH-SOORT-1 panel filter (wave 1c): filters by the match's contract form.
  contractFormFilter: string[]; setContractFormFilter: Dispatch<SetStateAction<string[]>>
  // MATCH-AXIS-FIX: filters by the match's contract TYPE (distinct axis, see
  // matchFilterGroups.ts header comment for the lookup-value/label tolerance).
  contractTypeFilter: string[]; setContractTypeFilter: Dispatch<SetStateAction<string[]>>
  kpiScored: boolean; setKpiScored: (fn: (v: boolean) => boolean) => void
  kpiUnscored: boolean; setKpiUnscored: (fn: (v: boolean) => boolean) => void
  dateRange: MatchDateRange | null; setDateRange: (v: MatchDateRange | null) => void
  showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
  // Optional: only registered while the tenant's approval mode is on (§4: one
  // filtering surface — the quick toggle and this panel entry stay in sync).
  pendingApprovalOnly?: boolean; setPendingApprovalOnly?: (fn: (v: boolean) => boolean) => void
  stageData: Opt[]; ownerData: Opt[]; clientData: Opt[]; branchOptions: Opt[]; contractFormOptions?: Opt[]
  contractTypeOptions?: Opt[]
}

export function buildMatchFilterGroups({
  t, tog, stageFilter, setStageFilter, ownerFilter, setOwnerFilter,
  clientFilter, setClientFilter, branchFilter, setBranchFilter, contractFormFilter, setContractFormFilter,
  contractTypeFilter, setContractTypeFilter,
  kpiScored, setKpiScored, kpiUnscored, setKpiUnscored,
  dateRange, setDateRange, showArchived, setShowArchived, pendingApprovalOnly, setPendingApprovalOnly,
  stageData, ownerData, clientData, branchOptions, contractFormOptions = [], contractTypeOptions = [],
}: BuildArgs) {
  const catMatch        = t('filters.categories.match')
  const catOrganisation = t('filters.categories.organisation')
  const catDisplay      = t('filters.categories.display')

  return [
    // ── Match: the funnel-continuation axes.
    { key: 'stage', type: 'search-select', category: catMatch, label: t('filters.status'), selected: stageFilter, options: stageData, onToggle: tog(setStageFilter) },
    {
      key: 'scored', type: 'checkbox', category: catMatch, label: t('filters.scoreState'),
      selected: [...(kpiScored ? ['scored'] : []), ...(kpiUnscored ? ['unscored'] : [])],
      options: [{ value: 'scored', label: t('kpi.scored') }, { value: 'unscored', label: t('kpi.unscored') }],
      onToggle: (v: string) => { if (v === 'scored') setKpiScored(x => !x); else setKpiUnscored(x => !x) },
    },
    // ── Organisatie: who/where a match sits.
    { key: 'owner',  type: 'search-select', category: catOrganisation, label: t('filters.owner'),  selected: ownerFilter,  options: ownerData,  onToggle: tog(setOwnerFilter) },
    { key: 'client', type: 'search-select', category: catOrganisation, label: t('insights.client'), selected: clientFilter, options: clientData, onToggle: tog(setClientFilter) },
    ...(branchOptions.length ? [{ key: 'branch', type: 'search-select', category: catOrganisation, label: t('common:filters.branch'), selected: branchFilter, options: branchOptions, onToggle: tog(setBranchFilter) }] : []),
    // Contract form (MATCH-SOORT-1) — reuse the existing column label key, mirrors the table (§4 one label per concept).
    ...(contractFormOptions.length ? [{ key: 'contractForm', type: 'search-select', category: catOrganisation, label: t('cols.contractForm'), selected: contractFormFilter, options: contractFormOptions, onToggle: tog(setContractFormFilter) }] : []),
    // Contract type (distinct axis from contract form) — reuses the existing column label.
    ...(contractTypeOptions.length ? [{ key: 'contractType', type: 'search-select', category: catOrganisation, label: t('drawer.contract.contractType'), selected: contractTypeFilter, options: contractTypeOptions, onToggle: tog(setContractTypeFilter) }] : []),
    // ── Weergave: match-date window + archived.
    {
      key: 'dateRange', type: 'date-range', category: catDisplay, label: t('filters.dateRange'),
      from: dateRange?.from ?? '', to: dateRange?.to ?? '',
      onFromChange: (v: string) => setDateRange({ from: v, to: dateRange?.to ?? '' }),
      onToChange:   (v: string) => setDateRange({ from: dateRange?.from ?? '', to: v }),
    },
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('filters.archived'), selected: showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('filters.archived') }], onToggle: () => setShowArchived(v => !v) },
    ...(setPendingApprovalOnly ? [{ key: 'pendingApproval', type: 'checkbox' as const, category: catDisplay, label: t('quickView.pendingApproval'), selected: pendingApprovalOnly ? ['pendingApproval'] : [], options: [{ value: 'pendingApproval', label: t('quickView.pendingApproval') }], onToggle: () => setPendingApprovalOnly(v => !v) }] : []),
  ]
}
