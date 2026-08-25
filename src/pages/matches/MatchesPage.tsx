/**
 * MatchesPage — the Matches list/board page (§3A blueprint): insights row,
 * table/board view toggle, bulk bar, drawer and the "+ Match" direct-match
 * flow. Route-level container — data fetching, filtering, bulk actions and
 * archive/trash flows each live in their own hook (§3); this file wires them
 * together and owns the page-level view state.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, LayoutList, Kanban, Archive, Trash2, ClipboardCheck } from 'lucide-react'
import ViewModeToggle from '@/components/ui/ViewModeToggle'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { usePublishSelection } from '@/context/SelectionContext'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useContractTypes } from '@/lib/useContractTypes'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { useMatchApprovalMode } from './hooks/useMatchApprovalMode'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { isReferenceQuery } from '@/lib/referenceNumber'
import { mergePatch } from '@/lib/mergePatch'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import MatchesTable from './MatchesTable'
import MatchesBoard from './MatchesBoard'
import type { BoardColumn } from './MatchesBoard'
import MatchDrawer from './MatchDrawer'
import { usePageMemory } from '@/lib/usePageMemory'
import MatchesBulkBar from './MatchesBulkBar'
// The full match form (§3B "direct match" path) — shared with the candidate
// drawer; without a fixed candidateId it shows its own candidate picker.
import { MatchModal } from '@/pages/candidates/shared'
import { useListPageSize } from '@/hooks/useListPageSize'
import PaginationBar from '@/components/ui/PaginationBar'
import ViewSwitch from '@/components/ui/ViewSwitch'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { useMatches, mapMatch, MATCHES_MAX_PER_PAGE } from './hooks/useMatches'
import { buildMatchFilterGroups } from './data/matchFilterGroups'
import type { MatchDateRange } from './data/matchFilterGroups'
import { useMatchesBulkActions } from './hooks/useMatchesBulkActions'
import { useMatchArchive } from './hooks/useMatchArchive'
import { useMatchMutations } from './hooks/useMatchMutations'
import { useTrashFlow } from '@/hooks/useTrashFlow'
import DeletionPreviewModal from '@/components/ui/DeletionPreviewModal'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

// MatchesPage — loads matches, shows an insights strip and paginates the table.
export default function MatchesPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('matches')
  // LOOKUP-I18N-1: the seeded match-status label renders in the user's language;
  // a tenant rename/creation passes through untouched.
  const seedLabel = useSeedLabel()
  const auth = useAuth()
  // Coupling is authorization-gated in the UI; the backend re-checks (§7).
  const hasPermission = auth?.hasPermission ?? (() => false)
  const [query,       setQuery]       = usePageMemory('matches.search', '')
  // NUMMER-1: a typed reference number (M-00042) narrows the fetch server-side to
  // an exact `?ref=` lookup instead of the client-side free-text filter below.
  const trimmedQuery = query.trim()
  const refQuery = isReferenceQuery(trimmedQuery) ? trimmedQuery : null
  // MATCH-ARCHIVED-LIST-1: reveal soft-deleted matches alongside the active set.
  const [showArchived, setShowArchived] = usePageMemory('matches.archived', false)
  // TRASH-OVERAL-2: the Prullenbak view (lifecycle pending_erase) — exclusive with
  // the archived view, mirrors the candidates page's three lifecycle views.
  const [showTrash, setShowTrash] = usePageMemory('matches.trash', false)
  // Data (fetch + mapping) lives in the hook (§3); the page only derives + renders.
  const { rows, loading, error, updateMatch, reload } = useMatches(refQuery, showArchived || showTrash)
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Match statuses drive the board columns + donut (R-1b lookup; the funnel is
  // an APPLICATION axis — the match resource no longer carries a stage).
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  const [page,        setPage]        = useState(1)
  // Shared page-size hook (§ audit 2026-08-05): useMatches already fetches the FULL
  // set client-side (loop, safety-capped at MATCHES_MAX_PAGES pages) and `pageSize`
  // only slices that in-memory array for display, so it never round-trips to the
  // server as `per_page` on its own (unlike Vacancies/Customers, which used to send
  // pageSize straight through). serverCap still passes MATCHES_MAX_PER_PAGE (200) so
  // the dropdown stays honest and matches every other 200-capped entity — never
  // offering a size (300/400/500) disconnected from what this page's own data ever
  // actually holds.
  const { pageSize, setPageSize, options: pageSizeOptions } = useListPageSize('matches', MATCHES_MAX_PER_PAGE)
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
  // MATCH-APPROVAL-QUEUE-1 (Danny: "geen lijst van te beoordelen matches" — the
  // manager review queue): client-side toggle over the already-loaded rows,
  // exactly like kpiScored/kpiUnscored above. The tenant's approval_mode gates
  // whether the affordance renders at all (see approvalReviewVisible below).
  const [pendingApprovalOnly, setPendingApprovalOnly] = usePageMemory('matches.pendingApproval', false)
  // goedkeuring-badge-eerlijk (08-08, same honesty gate MatchApprovalBadge uses):
  // with approval_mode 'uit' every match auto-approves and NOTHING can ever move
  // it into 'pending', so a permanent "Te beoordelen" 0-tile would be noise.
  const { approvalMode } = useMatchApprovalMode()
  const approvalReviewVisible = approvalMode !== 'uit'
  // Match-date window (a single removable range, not multi-value).
  const [dateRange, setDateRange] = usePageMemory<MatchDateRange | null>('matches.dateRange', null)
  // Start of the current month, captured once (purity — feeds the "Nieuw" KPI).
  const [monthStart] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime() })
  // Bulk selection (checkboxes); accumulates across pages, clears on filter change.
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  // KOIOS-SELECTIE-CONTEXT-1: mirror the selection into Koios AI's context chip.
  usePublishSelection('matches', selectedIds)
  const { toggleRow, toggleAll, bulkCoupleHelloFlex, bulkCoupleShiftmanager } =
    useMatchesBulkActions({ selectedIds, setSelectedIds, t })

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

  // Reset to the first page and clear the selection whenever a filter changes
  // (kept out of the memo — setting state during render can loop).
  useEffect(() => { setPage(1); setSelectedIds(new Set()) },
    [stageFilter, ownerFilter, clientFilter, branchFilter, contractFormFilter, contractTypeFilter, kpiScored, kpiUnscored, pendingApprovalOnly, dateRange, query, showArchived, showTrash])

  // Filter the visible rows by donut selection. A reference-number query already
  // narrowed `rows` server-side (exact `?ref=` lookup) — skip the free-text
  // re-filter so the single matched row isn't accidentally filtered back out.
  const filteredAll = useMemo(() => {
    const q = refQuery ? '' : query.trim().toLowerCase()
    return rows.filter(r => {
      // Three lifecycle views (TRASH-OVERAL-2, mirrors candidates): trash =
      // pending_erase only, archived = archived only, default = active only.
      if (showTrash) { if (r.lifecycle !== 'pending_erase') return false }
      else if (showArchived) { if (r.lifecycle !== 'archived') return false }
      else if (r.archived) return false
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

  // Board rows never include archived matches: dragging one to a new status would
  // PATCH /matches/{id}, which 404s once soft-deleted (MatchController::update has
  // no withTrashed()) — the archived-mixed view is table-only, mirrors the meta
  // picker/approval actions the drawer already hides for an archived match.
  const boardRows = useMemo(() => filteredAll.filter(r => !r.archived), [filteredAll])

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const paged     = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

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

  // Direct-match creation modal (§3B "direct match" path).
  const [addOpen, setAddOpen] = useState(false)
  // Read-only drill-down: the clicked row opens the MatchDrawer beside the table.
  const [selected, setSelected] = useState<MatchRow | null>(null)
  // Cross-entity open ({ open: id }): the drawer needs the ROW, so park the id until
  // the rows are loaded, then select the matching one (candidate drawer → match).
  const [pendingOpenId, setPendingOpenId] = useState<Id | null>(null)
  // Guards the one-shot direct fetch for a deep-link open (see effect below).
  const fetchingOpenRef = useRef<string | null>(null)
  // Seed the contract-form filter from a navigation intent (e.g. the ops
  // dashboard donut's slice click) — mirrors CandidatesPage's intent effect.
  useEffect(() => {
    const contractForm = (intent as { contract_form?: unknown } | undefined)?.contract_form
    if (contractForm != null) setContractFormFilter([String(contractForm)])
    // MATCH-AXIS-FIX: same seeding for the distinct contract-TYPE intent (e.g.
    // the ops-dashboard MatchesByContractTypeDonut's slice click).
    const contractType = (intent as { contract_type?: unknown } | undefined)?.contract_type
    if (contractType != null) setContractTypeFilter([String(contractType)])
  }, [intent, setContractFormFilter, setContractTypeFilter])

  useOpenFromIntent(intent, (id) => setPendingOpenId(id))
  useEffect(() => {
    if (pendingOpenId == null) return
    const row = rows.find(r => String(r.id) === String(pendingOpenId))
    if (row) { setSelected(row); setPendingOpenId(null); return }
    // Deep-link fallback (Danny 20-07: match-link 'deed niets'): the target may not
    // be in the loaded page (pagination/filters) — fetch it directly, like the
    // candidates/vacancies openById paths, instead of silently dropping the open.
    if (loading || fetchingOpenRef.current === String(pendingOpenId)) return
    fetchingOpenRef.current = String(pendingOpenId)
    api.get(`/matches/${pendingOpenId}`, { params: { include_archived: 1 } })
      .then(r => { setSelected(mapMatch(unwrap(r))); setPendingOpenId(null) })
      .catch(() => { notifyError(t('page.openNotFound')); setPendingOpenId(null) })
      .finally(() => { fetchingOpenRef.current = null })
  }, [pendingOpenId, rows, loading, t])
  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same match (NAV-BACK-1). Reuses the
  // existing pendingOpenId deferral above instead of a second lookup mechanism.
  useDrawerUrl({ selectedId: selected?.id, openById: setPendingOpenId, close: () => setSelected(null), intent })
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  // Shared row-patch: optimistic list update + keep the open drawer's copy in
  // sync. Reused by the approval workflow AND the contract/financial edit (both
  // just patch fields on the same row — no need for two persistence paths).
  const patchRow = (id: MatchRow['id'], patch: Partial<MatchRow>) => {
    updateMatch(id, patch)
    // ZZP-MERGE-1: deep-merge (never shallow-spread), see useMatches.updateMatch.
    setSelected(p => (p && p.id === id ? mergePatch(p as unknown as Record<string, unknown>, patch) as unknown as MatchRow : p))
  }

  // ARCHIVE-1: per-id archive/restore (enkelstuks-sweep, BE 9170e40) — gated on
  // matches.update, the same permission the DELETE/restore routes themselves require.
  const { archiveMatch, restoreMatch, dialog: archiveConfirmDialog } = useMatchArchive({ onPatch: patchRow, onReload: reload })
  const canArchive = hasPermission('matches.update')

  // TRASH-OVERAL-2: mark/unmark wiring + the shared preview-modal state. Mark is
  // gated matches.delete (button HIDDEN without it — §7 no fake affordances);
  // unmark reuses the matches.update gate the archive/restore routes carry.
  const trash = useTrashFlow({
    entityPath: 'matches',
    onMarked: () => { setSelected(null); reload() },
    onUnmarked: () => { setSelected(null); reload() },
  })
  const canMarkDeletion = hasPermission('matches.delete')
  // Human label for the modal intro — candidate + vacancy (— is a data separator here).
  const openMarkDeletion = (id: MatchRow['id']) => {
    if (id == null) return
    const row = rows.find(r => String(r.id) === String(id)) ?? selected
    const label = [row?.candidate, row?.vacancy].filter(v => v && v !== '—').join(' — ') || String(id)
    trash.openFor(String(id), label)
  }

  // View toggle: table ⇄ board (planboard). Board columns = the tenant match
  // statuses (R-1b lookup + seed fallback) so there are always columns to drag.
  const [view, setView] = usePageMemory<'table' | 'board'>('matches.view', 'table')
  // Scroll container for row virtualization — DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  // Fallback column swatch colour, consumed via hex+alpha string concatenation in
  // MatchesBoard (column.color + '20') — cannot become a CSS var without restructuring that.
  const stageColumns: BoardColumn[] = useMemo(
    // eslint-disable-next-line no-restricted-syntax -- fallback swatch hex, consumed as hex+alpha string concat in MatchesBoard
    () => matchStatuses.map(st => ({ key: st.value, label: st.label, color: st.color ?? '#6B7280' })), [matchStatuses])

  // Bug-class fix (optimistic-revert audit): board drag, the drawer's status
  // picker and the Extra tab's custom fields used to leave a rejected PATCH's
  // optimistic value sitting on screen with only a toast — no revert. The
  // snapshot/revert logic (both the row list and the open drawer, per field)
  // now lives in useMatchMutations, kept out of the page so it stays under the
  // ~400-line split trigger (§3) and each mutation is unit-testable on its own.
  const { setStatus, setOwner, updateCustomFields } = useMatchMutations({ rows, selected, updateMatch, setSelected })
  // Drag a card to another column → change the match's STATUS.
  const handleMove = (id: Id, statusKey: string) => setStatus(id, statusKey)

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Table area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Insights strip — donuts + KPI cards */}
      <InsightsRow
        donuts={insightDonuts}
        kpis={insightKpis}
        clearTitle={t('insights.clearFilter')}
      />

      {/* Toolbar — bulk bar or add button (left) + segmented view/archive selector (right) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 12px', flexShrink: 0, minHeight: 36 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedIds.size > 0 ? (
            <MatchesBulkBar
              count={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              onCoupleHelloFlex={bulkCoupleHelloFlex}
              onCoupleShiftmanager={bulkCoupleShiftmanager}
            />
          ) : (
            // Create a direct match (candidate + vacancy) from the Matches page.
            // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
            <Button variant="primary" size="md"
              onClick={() => setAddOpen(true)}>
              <Plus size={15} aria-hidden="true" /> {t('add.button')}
            </Button>
          )}
          {/* Shared search — mirror the other list pages (§3A). */}
          <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={260} />
          {/* RIGHTPANEL-FILTERS-1 (Danny 2026-08-14, "rode filters moeten naar rechts
              filter menu"): stage/owner/client/branch/score/date-range/archived all
              live in the right-hand filter panel now (buildMatchFilterGroups above) —
              the toolbar's own MatchFilterBar (stage/owner triggers + a "More filters"
              popover for client) was an exact duplicate of that panel and is deleted,
              not moved: both copies drove the SAME stageFilter/ownerFilter/clientFilter
              state, so nothing here changes which rows a user sees. */}
          <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
        </div>

        {/* Right — archived toggle + icon-only view toggle (mirror vacancies/opportunities). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* MATCH-APPROVAL-QUEUE-1: shared quick-view toggle (§4) — honesty-gated,
              absent entirely once the tenant's approval_mode is 'uit' (mirrors the
              KPI tile's own gate above). */}
          {approvalReviewVisible && (
            <QuickViewToggle active={pendingApprovalOnly} onToggle={() => setPendingApprovalOnly(v => !v)}
              label={t('quickView.pendingApproval')} color="var(--color-warning)" icon={ClipboardCheck} />
          )}
          {/* Archived (soft-deleted) — shared quick-view toggle (§4); exclusive with
              the trash view below (TRASH-OVERAL-2, mirrors candidates). */}
          <QuickViewToggle active={showArchived} onToggle={() => { setShowArchived(v => !v); setShowTrash(false) }}
            label={t('view.archived')} color="var(--color-archive)" icon={Archive} />
          {/* Prullenbak (pending erase) — same shared toggle, candidates' trash colour. */}
          <QuickViewToggle active={showTrash} onToggle={() => { setShowTrash(v => !v); setShowArchived(false) }}
            label={t('common:trash.view')} color="var(--color-trash)" icon={Trash2} />
          {/* View toggle — shared soft-tint component (§4), never a solid fill. */}
          <ViewModeToggle value={view} onChange={setView} options={[
            { id: 'table', icon: LayoutList, label: t('view.matches') },
            { id: 'board', icon: Kanban, label: t('view.board') },
          ]} />
        </div>
      </div>

      {/* Table ⇄ board — ViewSwitch keeps both mounted (display toggle, not
          unmount) so the table's virtualizer never remeasures 0 on returning from
          the board (§ViewSwitch); row virtualization is now safe to enable. */}
      <ViewSwitch active={view} views={[
        {
          id: 'table',
          render: () => (
            <>
              <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
                <MatchesTable rows={paged} loading={loading} error={error} stickyHeader scrollParentRef={tableScrollRef}
                  onRowClick={setSelected} selectedId={selected?.id}
                  selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
              </div>

              <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
                pageSize={pageSize} onPageChange={setPage}
                onPageSizeChange={n => { setPageSize(n); setPage(1) }} pageSizeOptions={pageSizeOptions} />
            </>
          ),
        },
        {
          id: 'board',
          render: () => (
            <MatchesBoard rows={boardRows} columns={stageColumns} onMove={handleMove}
              onSelect={setSelected} selectedId={selected?.id} />
          ),
        },
      ]} />
      </div>

      {/* Read-only drill-down drawer */}
      <MatchDrawer match={selected} allRows={rows} onClose={() => setSelected(null)}
        expanded={drawerExpanded} onToggleExpand={() => setDrawerExpanded(v => !v)}
        onSetStatus={(status) => { if (selected?.id != null) setStatus(selected.id, status) }}
        // MATCH-OWNER-1: reassign the owner (PATCH owner_id) — same optimistic-revert
        // path as the status picker. Gated on matches.update (the backend re-checks, §7).
        onSetOwner={hasPermission('matches.update') ? (user) => { if (selected?.id != null) setOwner(selected.id, user) } : undefined}
        // Approval workflow (§7 — UI-only gate; the backend re-checks matches.update).
        canApprove={hasPermission('matches.update')}
        onApprovalChange={patchRow}
        onUpdate={patchRow}
        onUpdateCustomFields={updateCustomFields}
        // ARCHIVE-1: per-id delete/restore (§7 — UI-only gate; the backend re-checks
        // matches.update on both routes).
        onArchive={canArchive ? archiveMatch : undefined}
        onRestore={canArchive ? restoreMatch : undefined}
        // TRASH-OVERAL-2: mark (matches.delete) opens the shared preview modal;
        // unmark (matches.update) puts a trashed match back to plain archived.
        onMarkDeletion={canMarkDeletion ? openMarkDeletion : undefined}
        onUnmark={canArchive ? (id) => { if (id != null) trash.unmark(id) } : undefined}
        graceDays={trash.graceDays}
        // EXTRACT-1: same matches.update gate as canApprove/canArchive above.
        canLinkBackoffice={hasPermission('matches.update')}
        // MATCH-TERMINATE-1: same gate — the backend re-checks on POST /terminate.
        canTerminate={hasPermission('matches.update')}
        // G04/MATCH-RENEWAL-1: same gate — the backend re-checks on POST /renew.
        canRenew={hasPermission('matches.update')} />

      {/* Direct-match creation: the full match form (rate proposal, contract,
          cost center) with a candidate picker; refetch so server-derived fields land. */}
      {addOpen && <MatchModal onClose={() => setAddOpen(false)} onCreated={reload} />}
      {archiveConfirmDialog}
      {/* TRASH-OVERAL-2: the ONE shared "Definitief verwijderen" preview dialog.
          Matches carry no transferable owner (preview.transferable stays null),
          so the modal renders without the transfer picker by itself. */}
      {trash.target && (
        <DeletionPreviewModal open onClose={trash.close} entityLabel={trash.target.label}
          preview={trash.preview} loading={trash.loading} error={trash.error}
          users={[]} onConfirm={trash.confirmMark} busy={trash.busy} blocked={trash.blocked}
          graceDays={trash.graceDays} />
      )}
    </div>
  )
}
