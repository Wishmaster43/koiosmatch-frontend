/**
 * useMatchesListFilters — the matches list's nine remembered filters, the
 * navigation-intent seeding and the client-side row predicate (§3 split out of
 * MatchesPage). The page keeps paging/selection; it resets them on `filterSignature`.
 */
import { useEffect, useMemo } from 'react'
import { matchesLifecycleView } from '@/lib/lifecycleFilter'
import { usePageMemory } from '@/lib/usePageMemory'
import { useContractTypes } from '@/lib/useContractTypes'
import type { MatchRow } from '@/types/match'
import type { MatchDateRange } from '../data/matchFilterGroups'

interface Args {
  rows: MatchRow[]
  query: string
  refQuery: string | null
  showArchived: boolean
  showTrash: boolean
  pendingApprovalOnly: boolean
  setPendingApprovalOnly: (v: boolean) => void
  approvalReviewVisible: boolean
  intent?: unknown
}

// Owns the filter state + predicate; returns values, setters, the filtered rows and a reset signature.
export function useMatchesListFilters({
  rows, query, refQuery, showArchived, showTrash, pendingApprovalOnly,
  setPendingApprovalOnly, approvalReviewVisible, intent,
}: Args) {
  const [stageFilter, setStageFilter] = usePageMemory<string[]>('matches.stage', [])
  // KPI attention toggle (Gem. score → only scored matches).
  const [kpiScored, setKpiScored] = usePageMemory('matches.scored', false)
  const [ownerFilter, setOwnerFilter] = usePageMemory<string[]>('matches.owner', [])
  const [clientFilter, setClientFilter] = usePageMemory<string[]>('matches.client', [])
  // VESTIGING: branch (bureau) filter — narrows to matches run from that branch.
  const [branchFilter, setBranchFilter] = usePageMemory<string[]>('matches.branch', [])
  // MATCH-SOORT-1 panel filter (wave 1c): narrows by the match's contract form.
  const [contractFormFilter, setContractFormFilter] = usePageMemory<string[]>('matches.contractForm', [])
  // MATCH-AXIS-FIX: distinct contract TYPE axis (matches.contract_type / the
  // ContractType lookup the ops-dashboard donut counts on) — a separate
  // dimension from the contract FORM above (§ CandidateType lookup). Stores
  // lookup VALUES.
  const [contractTypeFilter, setContractTypeFilter] = usePageMemory<string[]>('matches.contractType', [])
  const { options: contractTypeLookupOptions } = useContractTypes()
  // Unscored complements kpiScored: both live in the right panel's one "score state" group.
  const [kpiUnscored, setKpiUnscored] = usePageMemory('matches.unscored', false)
  // Match-date window (a single removable range, not multi-value).
  const [dateRange, setDateRange] = usePageMemory<MatchDateRange | null>('matches.dateRange', null)

  // One string that changes whenever any filter changes — drives the page's reset effect.
  const filterSignature = useMemo(() => JSON.stringify([
    stageFilter, ownerFilter, clientFilter, branchFilter, contractFormFilter, contractTypeFilter,
    kpiScored, kpiUnscored, pendingApprovalOnly, dateRange, query, showArchived, showTrash,
  ]), [stageFilter, ownerFilter, clientFilter, branchFilter, contractFormFilter, contractTypeFilter,
    kpiScored, kpiUnscored, pendingApprovalOnly, dateRange, query, showArchived, showTrash])

  // Filter the visible rows by donut selection. A reference-number query already
  // narrowed `rows` server-side (exact `?ref=` lookup) — skip the free-text
  // re-filter so the single matched row isn't accidentally filtered back out.
  const filteredAll = useMemo(() => {
    const q = refQuery ? '' : query.trim().toLowerCase()
    return rows.filter(r => {
      // Three lifecycle views (TRASH-OVERAL-2, mirrors candidates): trash =
      // pending_erase only, archived = archived only, default = active only.
      if (!matchesLifecycleView(r, showTrash, showArchived)) return false
      if (stageFilter.length && !stageFilter.includes(r.status)) return false
      if (kpiScored && typeof r.score !== 'number') return false
      if (kpiUnscored && typeof r.score === 'number') return false
      // MATCH-APPROVAL-QUEUE-1: client-side over the loaded rows, same mechanism
      // as kpiScored/kpiUnscored above (approval_status already rides on every row).
      // Gated like its toggle/KPI (approvalReviewVisible): with approval 'uit'
      // a page-memory-remembered toggle must never keep filtering invisibly.
      if (approvalReviewVisible && pendingApprovalOnly && r.approval_status !== 'pending') return false
      if (ownerFilter.length && !ownerFilter.includes(r.owner)) return false
      if (clientFilter.length && !clientFilter.includes(r.client)) return false
      if (branchFilter.length && !branchFilter.includes(r.branchName ?? '')) return false
      if (contractFormFilter.length && !contractFormFilter.includes(r.contractForm?.value ?? '')) return false
      // Contract-type predicate tolerates BOTH the lookup value and its label:
      // the drawer's contract-type select writes the LABEL (OverviewTab.tsx
      // useContractTypes().types), while the dashboard feed counts on the
      // VALUE — see OPEN_QUESTIONS for the CMBE ask to unify this server-side.
      if (contractTypeFilter.length) {
        const selectedLabels = contractTypeLookupOptions
          .filter(o => contractTypeFilter.includes(o.value))
          .map(o => o.label)
        const rowType = r.contractType ?? ''
        if (!contractTypeFilter.includes(rowType) && !selectedLabels.includes(rowType)) return false
      }
      if (dateRange?.from && (!r.date || new Date(r.date).getTime() < new Date(dateRange.from).getTime())) return false
      if (dateRange?.to && (!r.date || new Date(r.date).getTime() > new Date(dateRange.to).getTime())) return false
      if (q && ![r.candidate, r.vacancy, r.client].some(v => String(v ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [rows, stageFilter, ownerFilter, clientFilter, branchFilter, contractFormFilter, contractTypeFilter, contractTypeLookupOptions,
      kpiScored, kpiUnscored, pendingApprovalOnly, approvalReviewVisible, dateRange, query, refQuery, showArchived, showTrash])

  // Seed filters from a navigation intent (e.g. the ops dashboard donut's slice click,
  // or MATCH-APPROVAL-2 notification navigation) — mirrors CandidatesPage's intent effect.
  useEffect(() => {
    const i = intent as { contract_form?: unknown; contract_type?: unknown; pendingApprovalOnly?: unknown } | undefined
    const contractForm = i?.contract_form
    if (contractForm != null) setContractFormFilter([String(contractForm)])
    // MATCH-AXIS-FIX: same seeding for the distinct contract-TYPE intent (e.g
    // the ops-dashboard MatchesByContractTypeDonut's slice click).
    const contractType = i?.contract_type
    if (contractType != null) setContractTypeFilter([String(contractType)])
    // MATCH-APPROVAL-2: a match.approval_pending notification lands with intent
    // { pendingApprovalOnly: true }. Activate the pending-approval quick view,
    // honesty-gated: absent entirely once the tenant's approval_mode is 'off'.
    if (i?.pendingApprovalOnly === true && approvalReviewVisible) {
      setPendingApprovalOnly(true)
    }
    // setContractFormFilter/setContractTypeFilter/setPendingApprovalOnly are
    // usePageMemory setters (stable identity) — listed to satisfy exhaustive-deps,
    // not because this effect should re-run on them.
  }, [intent, setContractFormFilter, setContractTypeFilter, setPendingApprovalOnly, approvalReviewVisible])

  return {
    stageFilter, setStageFilter, ownerFilter, setOwnerFilter, clientFilter, setClientFilter,
    branchFilter, setBranchFilter, contractFormFilter, setContractFormFilter,
    contractTypeFilter, setContractTypeFilter, contractTypeLookupOptions,
    kpiScored, setKpiScored, kpiUnscored, setKpiUnscored, dateRange, setDateRange,
    filteredAll, filterSignature,
  }
}
