/**
 * useMatchesInsights — the Matches page's donut/KPI aggregation and right-panel
 * filter-group wiring, extracted verbatim from MatchesPage (§0.3 split). Takes
 * the loaded rows plus every filter dimension's state pair and returns the
 * derived donut/KPI datasets, the right-panel filter groups, and the
 * clear-all-filters helper. Pure extraction — no behaviour change.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { buildMatchFilterGroups } from '../data/matchFilterGroups'
import type { MatchDateRange } from '../data/matchFilterGroups'
import type { MatchRow } from '@/types/match'
import type { FilterGroup } from '@/context/RightPanelContext'

// Shape of a match-status lookup entry (label/colour/is_closed) as returned by useMatchStatuses.
type MatchStatusMeta = (status: string) => { label?: string; color?: string; is_closed?: boolean } | undefined

interface UseMatchesInsightsArgs {
  rows: MatchRow[]
  t: TFunction
  matchStatusMeta: MatchStatusMeta
  seedLabel: (kind: string, opts: { value: string; label: string }) => string
  monthStart: number
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  stageFilter: string[]; setStageFilter: Dispatch<SetStateAction<string[]>>
  ownerFilter: string[]; setOwnerFilter: Dispatch<SetStateAction<string[]>>
  clientFilter: string[]; setClientFilter: Dispatch<SetStateAction<string[]>>
  branchFilter: string[]; setBranchFilter: Dispatch<SetStateAction<string[]>>
  contractFormFilter: string[]; setContractFormFilter: Dispatch<SetStateAction<string[]>>
  contractTypeFilter: string[]; setContractTypeFilter: Dispatch<SetStateAction<string[]>>
  contractTypeLookupOptions: { value: string; label: string }[]
  kpiScored: boolean; setKpiScored: Dispatch<SetStateAction<boolean>>
  kpiUnscored: boolean; setKpiUnscored: Dispatch<SetStateAction<boolean>>
  dateRange: MatchDateRange | null; setDateRange: Dispatch<SetStateAction<MatchDateRange | null>>
  showArchived: boolean; setShowArchived: Dispatch<SetStateAction<boolean>>
  showTrash: boolean; setShowTrash: Dispatch<SetStateAction<boolean>>
  pendingApprovalOnly: boolean; setPendingApprovalOnly: Dispatch<SetStateAction<boolean>>
  approvalReviewVisible: boolean
  registerFilters: (key: string, groups: FilterGroup[]) => void
  unregisterFilters: (key: string) => void
}

export function useMatchesInsights(args: UseMatchesInsightsArgs) {
  const {
    rows, t, matchStatusMeta, seedLabel, monthStart, query, setQuery,
    stageFilter, setStageFilter, ownerFilter, setOwnerFilter, clientFilter, setClientFilter,
    branchFilter, setBranchFilter, contractFormFilter, setContractFormFilter,
    contractTypeFilter, setContractTypeFilter, contractTypeLookupOptions,
    kpiScored, setKpiScored, kpiUnscored, setKpiUnscored,
    dateRange, setDateRange, showArchived, setShowArchived, showTrash, setShowTrash,
    pendingApprovalOnly, setPendingApprovalOnly, approvalReviewVisible,
    registerFilters, unregisterFilters,
  } = args

  // Donut click: toggle one value (second click clears).
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
    const dd = d as { key?: string; payload?: { key?: string }; name?: string }
    const v = dd?.key ?? dd?.payload?.key ?? dd?.name
    if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
  }

  // Aggregate status data for the donut (label/colour from the lookup).
  // LOOKUP-I18N-1: the seeded status label renders in the user's language; `key`
  // stays the raw status value so the donut click still filters on it.
  const stageData = useMemo(() => {
    const m: Record<string, { name: string; key: string; color?: string; value: number }> = {}
    rows.forEach(r => {
      if (!r.status) return
      const meta = matchStatusMeta(r.status)
      ;(m[r.status] ??= { name: seedLabel('matchStatuses', { value: r.status, label: meta?.label ?? r.status }), key: r.status, color: meta?.color, value: 0 }).value++
    })
    return Object.values(m)
  }, [rows, matchStatusMeta, seedLabel])

  const ownerData = useMemo(() => {
    // No explicit colour: the donut assigns its palette per owner (one grey for ALL
    // owners was the bug — a hardcoded colour suppresses the palette fallback).
    const m: Record<string, { name: string; key: string; value: number }> = {}
    rows.forEach(r => { if (r.owner) (m[r.owner] ??= { name: r.owner, key: r.owner, value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  // Client distribution (3rd donut) — palette per client (Danny: 9 KPIs everywhere).
  const clientData = useMemo(() => {
    const m: Record<string, { name: string; key: string; value: number }> = {}
    rows.forEach(r => { if (r.client && r.client !== '—') (m[r.client] ??= { name: r.client, key: r.client, value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  // Branch distribution — right-panel-only filter dimension (no toolbar/donut twin).
  const branchData = useMemo(() => {
    const m: Record<string, { value: string; label: string; count: number }> = {}
    rows.forEach(r => { if (r.branchName) (m[r.branchName] ??= { value: r.branchName, label: r.branchName, count: 0 }).count++ })
    return Object.values(m)
  }, [rows])

  // Contract-form distribution — right-panel-only filter dimension.
  const contractFormData = useMemo(() => {
    const m: Record<string, { value: string; label: string; count: number }> = {}
    rows.forEach(r => { if (r.contractForm) (m[r.contractForm.value] ??= { value: r.contractForm.value, label: r.contractForm.label, count: 0 }).count++ })
    return Object.values(m)
  }, [rows])

  // Contract-type filter options come straight from the tenant lookup (not the
  // loaded rows), since rows may carry either the lookup value or its label
  // (VOCABULARY CAVEAT — see the predicate below and OPEN_QUESTIONS).
  const contractTypeData = useMemo(
    () => contractTypeLookupOptions.map(o => ({ value: o.value, label: o.label })),
    [contractTypeLookupOptions])

  // Multi-select toggle for the right-panel filter groups (add/remove a value).
  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string | number) =>
    set(p => p.includes(String(v)) ? p.filter(x => x !== String(v)) : [...p, String(v)])

  // Right-panel filters: stage/owner/client/branch/score-state/date-range/archived
  // — pure builder (§0.3 split). The same stageFilter/ownerFilter drive the donuts,
  // so both stay in sync.
  const filterGroups = useMemo(() => buildMatchFilterGroups({
    t, tog,
    stageFilter, setStageFilter, ownerFilter, setOwnerFilter, clientFilter, setClientFilter,
    branchFilter, setBranchFilter, contractFormFilter, setContractFormFilter,
    contractTypeFilter, setContractTypeFilter, kpiScored, setKpiScored, kpiUnscored, setKpiUnscored,
    dateRange, setDateRange, showArchived, setShowArchived,
    ...(approvalReviewVisible ? { pendingApprovalOnly, setPendingApprovalOnly } : {}),
    stageData: stageData.map(d => ({ value: d.key, label: d.name, count: d.value })),
    ownerData: ownerData.map(d => ({ value: d.key, label: d.name, count: d.value })),
    clientData: clientData.map(d => ({ value: d.key, label: d.name, count: d.value })),
    branchOptions: branchData,
    contractFormOptions: contractFormData,
    contractTypeOptions: contractTypeData,
  }), [t, stageFilter, setStageFilter, ownerFilter, setOwnerFilter, clientFilter, setClientFilter,
       branchFilter, setBranchFilter, contractFormFilter, setContractFormFilter,
       contractTypeFilter, setContractTypeFilter, kpiScored, setKpiScored, kpiUnscored, setKpiUnscored,
       dateRange, setDateRange, showArchived, setShowArchived,
       approvalReviewVisible, pendingApprovalOnly, setPendingApprovalOnly,
       stageData, ownerData, clientData, branchData, contractFormData, contractTypeData])

  // Register/unregister the filters in the right panel.
  useEffect(() => {
    registerFilters('matches-page', filterGroups)
    return () => unregisterFilters('matches-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // KPI: open vs closed via the is_closed FLAG (never the slug — R-1b).
  const isClosed    = (r: MatchRow) => Boolean(matchStatusMeta(r.status)?.is_closed)
  const activeCount = rows.filter(r => !isClosed(r)).length
  const closedCount = rows.filter(isClosed).length
  const avgScore    = rows.length ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.length) : null
  // New this month + matches still lacking a score (both derived from the rows).
  const newThisMonthCount = rows.filter(r => r.date && new Date(r.date).getTime() >= monthStart).length
  const unscoredCount     = rows.filter(r => typeof r.score !== 'number').length
  // MATCH-APPROVAL-QUEUE-1: counted off the full server-wide row set, same as
  // every other KPI above — never the paged/filtered slice.
  const pendingApprovalCount = rows.filter(r => r.approval_status === 'pending').length

  // Donuts drive the stage/owner filters; each clears its own selection.
  const insightDonuts: DonutSpec[] = [
    { key: 'stage', title: t('insights.status'), data: stageData, onPick: pickOne(setStageFilter),
      active: stageFilter.length > 0, onClear: () => setStageFilter([]) },
    { key: 'owner', title: t('insights.owner'), data: ownerData, onPick: pickOne(setOwnerFilter),
      active: ownerFilter.length > 0, onClear: () => setOwnerFilter([]) },
    { key: 'client', title: t('insights.client'), data: clientData, onPick: pickOne(setClientFilter),
      active: clientFilter.length > 0, onClear: () => setClientFilter([]) },
  ]

  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(query.trim() || kpiScored || kpiUnscored || (approvalReviewVisible && pendingApprovalOnly) || stageFilter.length || ownerFilter.length
    || clientFilter.length || branchFilter.length || contractFormFilter.length || contractTypeFilter.length || dateRange || showArchived || showTrash)
  const [searchEpoch, setSearchEpoch] = useState(0)
  // Resets every filter dimension (and bumps the search epoch) back to defaults in one action.
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setKpiScored(false); setKpiUnscored(false); setPendingApprovalOnly(false)
    setStageFilter([]); setOwnerFilter([]); setClientFilter([]); setBranchFilter([]); setContractFormFilter([]); setContractTypeFilter([]); setDateRange(null); setShowArchived(false); setShowTrash(false)
  }

  // KPI clicks drive the existing stage filter (chip + clear come for free);
  // clicking the active card again clears (mirror of the kansen cards).
  const eqSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')
  const activeStages = [...new Set(rows.filter(r => !isClosed(r)).map(r => r.status).filter(Boolean))]
  const closedStages = [...new Set(rows.filter(isClosed).map(r => r.status).filter(Boolean))]
  const toggleStages = (labels: string[]) => { if (labels.length) setStageFilter(p => (eqSet(p, labels) ? [] : labels)) }
  const insightKpis: KpiSpec[] = [
    // Totaal is the neutral card: clicking clears, but it never shows as "aan"
    // (the default highlight read as an active filter — Danny 2026-07-06).
    { key: 'total',    label: t('kpi.total'),    value: rows.length, color: 'var(--color-primary-text)',
      onClick: () => { setStageFilter([]); setOwnerFilter([]); setKpiScored(false) } },
    { key: 'active',   label: t('kpi.active'),   value: activeCount, color: 'var(--color-primary-text)',
      onClick: () => toggleStages(activeStages), active: stageFilter.length > 0 && eqSet(stageFilter, activeStages) },
    { key: 'closed',   label: t('kpi.closed'),   value: closedCount, color: 'var(--color-success-text)',
      onClick: () => toggleStages(closedStages), active: stageFilter.length > 0 && eqSet(stageFilter, closedStages) },
    { key: 'newThisMonth', label: t('kpi.newThisMonth'), value: newThisMonthCount, color: 'var(--color-primary-text)',
      onClick: () => { setStageFilter([]); setOwnerFilter([]); setClientFilter([]); setKpiScored(false) } },
    { key: 'unscored', label: t('kpi.unscored'), value: unscoredCount, color: 'var(--color-warning)',
      onClick: () => setKpiScored(false) },
    { key: 'avgScore', label: t('kpi.avgScore'), value: avgScore != null ? `${avgScore}%` : '—', color: 'var(--color-primary-text)',
      onClick: () => setKpiScored(v => !v), active: kpiScored },
    // MATCH-APPROVAL-QUEUE-1: honesty-gated (goedkeuring-badge-eerlijk) — absent
    // entirely once the tenant's approval_mode is 'uit', never a permanent 0-tile.
    ...(approvalReviewVisible ? [{
      key: 'pendingApproval', label: t('kpi.pendingApproval'), value: pendingApprovalCount, color: 'var(--color-warning)',
      onClick: () => setPendingApprovalOnly(v => !v), active: pendingApprovalOnly,
    }] : []),
  ]

  return {
    stageData, ownerData, clientData, branchData, contractFormData, contractTypeData,
    insightDonuts, insightKpis, anyFilterActive, clearAllFilters, searchEpoch,
  }
}
