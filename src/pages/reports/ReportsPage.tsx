/**
 * ReportsPage — thin router for the analytical reports (B-28, RAPPORTEN-OMBOUW-1).
 * The old inner tab bar is GONE (Danny 13-08: every report is its own sub-page,
 * reached from the sidebar's Rapporten submenu). This shell only resolves the
 * active report from the route key handed down by appPages (#reports.<id>) and
 * renders it full-page.
 *
 * Right-hand filter panel (Danny 14-08: "elke pagina wordt een dashboardpagina
 * met filtermenu rechts"). Every report registers into the shared
 * `RightPanelContext` — the same panel DashboardLayout already renders for every
 * other page (§0 consistency): the always-present `period` group, plus (WAVE 1c,
 * 2026-08-25) status/owner/branch(+customer) and each report's own per-page
 * dimensions, gated to exactly the field(s) that report's backend segmentQuery()
 * reads — never a group that LOOKS like a real filter but does nothing server-side
 * (an honesty finding). `buildReportQueryParams` (./reportFilterParams, own unit
 * test) is the single seam that turns panel state into request params, gated the
 * same way. Each report's own `use<X>Report` hook still builds its own `api.get`
 * call unchanged; this page only owns the panel and the filter state it feeds.
 *
 * RIGHTPANEL-FILTERS-1 (2026-08-14, Danny: "rode filters moeten naar rechts
 * filter menu"): the inline period `CreatableSelect` that used to travel down
 * through a `tabsSlot` prop into every report's own toolbar row is GONE — it was
 * an exact duplicate of the `period` group already registered below (both drove
 * the same `period` state), the same "two doors, one room" pattern the matches
 * page toolbar had. The panel is now the ONLY place `period` is picked; every
 * report component had its now-unused `tabsSlot` prop removed to match.
 *
 * RAPPORTEN-CONSOLIDATIE-1 (2026-08-14, Danny's sidebar screenshot: "nog steeds
 * een veel te lange lijst"): nineteen sub-pages became thirteen — five pairs/
 * groups merged into one page each with a top-right switch (mirrors the
 * Shiftmanager dashboard's "In uren / In diensten" toggle). `initialView` below
 * seeds a merged page's switch position for a LEGACY route (e.g. the old
 * `reports.leads` deep link still resolves here, now as `reportId="candidates"
 * initialView="leads"` — appPages.tsx does that mapping via
 * `LEGACY_REPORT_ROUTE_ALIASES`, reportIds.ts); the canonical route
 * (`reports.candidates`) omits it and gets that page's own default position.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { useLookups } from '@/context/LookupsContext'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import { useUsers } from '@/lib/queries'
import { useLocations } from '@/lib/useLocations'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useCustomerOptions } from '@/pages/vacancies/shared'
import { useApplicationSources } from '@/lib/useApplicationSources'
import { useApplicationStages } from '@/hooks/useApplicationStages'
import { useRejectionReasons } from '@/lib/useRejectionReasons'
import { useTeams } from '@/lib/useTeams'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { useOutreachStatuses } from '@/lib/useOutreachStatuses'
import {
  useVacancyStatusIdOptions, useTaskStatusIdOptions, useTaskTypeIdOptions, useTaskPriorityIdOptions,
} from './reportStatusLookups'
import { isFilterableReport, CUSTOMER_FILTERABLE_REPORT_IDS, acceptsStatusBranchFilter } from './reportFilterParams'
import { reportSupportsCompare } from './reportCompareSupport'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import type { ReportFilterState } from './reportFilterParams'
import type { ReportFilterGroup } from '@/types/reports'
import CandidatesReport from './CandidatesReport'
import ApplicationsReport from './ApplicationsReport'
import CustomersReport from './CustomersReport'
import VacanciesReport from './VacanciesReport'
import OpportunitiesReport from './OpportunitiesReport'
import TasksReport from './TasksReport'
import MatchesReport from './MatchesReport'
import OutreachReport from './OutreachReport'
import WhatsappReport from './WhatsappReport'
import ReportsDashboard from './ReportsDashboard'
import { REPORT_IDS } from './reportIds'
import type { ReportId } from './reportIds'
import type { ReportPeriod } from '@/types/analytics'

// Every report takes the same contract: the chosen period + the optional filters +
// the optional initial switch position. `filters` is optional and (WAVE 1c) READ
// by every report today — all nine ids on REPORT_IDS now sit on
// FILTERABLE_REPORT_IDS too. `initialView` (RAPPORTEN-CONSOLIDATIE-1) seeds a
// merged page's switch position — read by the two merged pages
// (candidates/customers), ignored by the rest.
// `compare` (RAPPORT-COMPARE-2): the compare window now lives in the right-hand
// filter panel (Danny 24-08: EVERY filter lives there — the toolbar control was
// the exact §4 violation). ReportsPage owns the state; a page consumes the prop
// the moment its toolbar control is removed (COMPARE_IN_PANEL below).
type ReportComponent = ComponentType<{ period: ReportPeriod; filters?: ReportFilterState; initialView?: string; compare?: ReportCompareMode }>

// Registry: report id → component. Ids and their order live in reportIds.ts
// (shared with the sidebar submenu); an id here without a REPORT_IDS entry — or
// vice versa — is a wiring bug the exhaustive Record type surfaces at compile time.
// Two entries (candidates/customers) render a merged page with a top-right
// population switch (RAPPORTEN-CONSOLIDATIE-1); the other merged pages retired
// with Danny's ten-page decision (RAPPORTEN-DANNY10-1, see reportIds.ts).
const REPORTS: Record<ReportId, ReportComponent> = {
  candidates:    CandidatesReport,
  applications:  ApplicationsReport,
  customers:     CustomersReport,
  vacancies:     VacanciesReport,
  opportunities: OpportunitiesReport,
  tasks:         TasksReport,
  matches:       MatchesReport,
  outreach:      OutreachReport,
  whatsapp:      WhatsappReport,
}

export default function ReportsPage({ reportId, initialView }: { reportId?: string; initialView?: string }) {
  const { t } = useTranslation('analytics')
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const { registerFilters, unregisterFilters } = useRightPanel()

  // A bare #reports (no reportId) is now its own KPI overview dashboard
  // (RAPPORTEN-DASHBOARD-1) — it no longer forwards to the first sub-report.
  // Only an UNKNOWN id (a genuinely stale deep-link) still falls back to the
  // first report; the root itself renders the dashboard branch below.
  const isRoot = reportId == null
  const active: ReportId = isRoot
    ? REPORT_IDS[0]
    : (REPORT_IDS as readonly string[]).includes(reportId)
      ? (reportId as ReportId)
      : REPORT_IDS[0]
  const Report = REPORTS[active]
  const filterable = isFilterableReport(active)

  // RAPPORT-COMPARE-2: compare lives in the right panel for EVERY supporting
  // report (the per-page toolbar controls are deleted — §4: one filtering
  // surface). The mode resets when the user switches reports, so one page's
  // comparison never leaks into the next page's numbers.
  const [compareMode, setCompareMode] = useState<ReportCompareMode>(COMPARE_OFF)
  useEffect(() => { setCompareMode(COMPARE_OFF) }, [active])
  const compareInPanel = !isRoot && reportSupportsCompare(active)

  // RAPPORT-FILTERS-1/2: status/owner/branch(+customer), wired for every report on
  // FILTERABLE_REPORT_IDS. Kept here, not per-report, so the panel and both hooks
  // read the exact same state — a report's own hook and its drilldown build their
  // request params from this one object via `buildReportQueryParams`, so bar and
  // lade can never disagree.
  const [status, setStatus] = useState<Array<string | number>>([])
  const [ownerId, setOwnerId] = useState<Array<string | number>>([])
  const [locationId, setLocationId] = useState<Array<string | number>>([])
  const [customerId, setCustomerId] = useState<Array<string | number>>([])
  // WAVE 1c: the per-page dimensions each filterable report's own segmentQuery()
  // reads — see reportFilterParams.ts's buildReportQueryParams for the exact
  // report→field gating.
  const [source, setSource] = useState<Array<string | number>>([])
  const [phase, setPhase] = useState<Array<string | number>>([])
  const [contractForm, setContractForm] = useState<Array<string | number>>([])
  const [stage, setStage] = useState<Array<string | number>>([])
  const [rejectionReason, setRejectionReason] = useState<Array<string | number>>([])
  const [taskType, setTaskType] = useState<Array<string | number>>([])
  const [priority, setPriority] = useState<Array<string | number>>([])
  const [teamId, setTeamId] = useState<Array<string | number>>([])
  const [direction, setDirection] = useState<Array<string | number>>([])
  const [escalated, setEscalated] = useState<boolean | null>(null)
  const [customerIds, setCustomerIds] = useState<Array<string | number>>([])
  const [origin, setOrigin] = useState<Array<string | number>>([])
  const [valueMin, setValueMin] = useState<number | null>(null)
  const [valueMax, setValueMax] = useState<number | null>(null)
  const filters: ReportFilterState = useMemo(() => ({
    status, ownerId, locationId, customerId,
    source, phase, contractForm,
    stage, vacancyId: [], rejectionReason,
    taskType, priority, teamId,
    direction, escalated,
    customerIds, origin,
    valueMin, valueMax,
  }), [status, ownerId, locationId, customerId, source, phase, contractForm, stage, rejectionReason,
    taskType, priority, teamId, direction, escalated, customerIds, origin, valueMin, valueMax])
  const acceptsCustomer = (CUSTOMER_FILTERABLE_REPORT_IDS as readonly string[]).includes(active)
  const acceptsStatusBranch = acceptsStatusBranchFilter(active)

  // Reset every dimension on EVERY report switch: vocabularies are per report
  // (a candidate status carried onto opportunities 422s there), so a selection
  // never lingers invisibly across pages (Opus wave-B2 — the old `filterable`
  // guard became dead code once all nine reports were filterable).
  useEffect(() => {
    setStatus([]); setOwnerId([]); setLocationId([]); setCustomerId([])
    setSource([]); setPhase([]); setContractForm([])
    setStage([]); setRejectionReason([])
    setTaskType([]); setPriority([]); setTeamId([])
    setDirection([]); setEscalated(null)
    setCustomerIds([]); setOrigin([])
    setValueMin(null); setValueMax(null)
  }, [active])

  // Lookup sources for the filter options — each entity keeps its OWN status
  // vocabulary (deployability/vacancy lifecycle/funnel bucket/match state/task
  // board), while owner (users) and branch (locations) are shared tenant lookups.
  // Vacancy/task statuses are validated by the backend against their raw lookup
  // ID, never the slug (see reportStatusLookups.ts) — a dedicated fetch, not the
  // page-scoped VacancyLookupsContext/TaskLookupsContext (unmounted here).
  const { statuses: candidateStatuses, phases: tenantPhases, candidateTypes } = useLookups()
  const { statuses: customerStatuses } = useCustomerLookups()
  const { data: users = [] } = useUsers() as { data?: Array<{ id?: string | number; name?: string }> }
  const locations = useLocations()
  const vacancyStatusOptions = useVacancyStatusIdOptions()
  const taskStatusOptions = useTaskStatusIdOptions()
  const taskTypeOptions = useTaskTypeIdOptions()
  const taskPriorityOptions = useTaskPriorityIdOptions()
  const { statuses: matchStatusesRaw } = useMatchStatuses()
  const matchStatusOptions = useMemo(() => matchStatusesRaw.map(s => ({ value: s.value, label: s.label })), [matchStatusesRaw])
  const { stages: opportunityStages } = useOpportunityStages()
  const { statuses: outreachStatuses } = useOutreachStatuses()
  // The applications panel filter narrows on the FLAG-derived funnel bucket
  // (active/matched/rejected/placed, ApplicationsReport::BUCKET_VALUES) — a fixed,
  // non-tenant vocabulary, so its options are i18n labels, never a lookup fetch.
  const applicationBucketOptions = useMemo(
    () => (['active', 'matched', 'rejected', 'placed'] as const).map(k => ({ value: k, label: t(`applications.buckets.${k}`) })),
    [t],
  )
  const customerOptions = useCustomerOptions(filterable && acceptsCustomer)
  const statusOptions = active === 'customers' ? customerStatuses
    : active === 'vacancies' ? vacancyStatusOptions
    : active === 'applications' ? applicationBucketOptions
    : active === 'matches' ? matchStatusOptions
    : active === 'tasks' ? taskStatusOptions
    : active === 'opportunities' ? opportunityStages
    : active === 'outreach' ? outreachStatuses
    : candidateStatuses
  const ownerOptions = useMemo(() => users.map(u => ({ value: u.id ?? '', label: u.name || '—' })).filter(o => o.value !== ''), [users])
  const branchOptions = useMemo(() => locations.map(l => ({ value: l.value, label: l.label })), [locations])

  // WAVE 1c per-page vocabulary sources — only fetched behind `filterable` /
  // the exact report(s) that read them, so an unrelated report never fires an
  // extra GET it will never use.
  const { sources: applicationSourceNames } = useApplicationSources()
  const sourceOptions = useMemo(() => applicationSourceNames.map(name => ({ value: name, label: name })), [applicationSourceNames])
  const phaseOptions = useMemo(() => tenantPhases.map(p => ({ value: p.value, label: p.label })), [tenantPhases])
  // 'none' sentinel mirrors the backend's own "no contract form" bucket both
  // candidates and matches already draw (AppliesReportFilters.php contract_form.*).
  const contractFormOptions = useMemo(
    () => [{ value: 'none', label: t('candidates.axes.contractFormNone') }, ...candidateTypes.map(c => ({ value: c.value, label: c.label }))],
    [candidateTypes, t],
  )
  const { stages: applicationStages } = useApplicationStages()
  const stageOptions = useMemo(
    () => [{ value: 'none', label: t('applications.axes.stageNone') }, ...applicationStages.map(s => ({ value: s.value, label: s.label }))],
    [applicationStages, t],
  )
  const { reasons: rejectionReasonOptions } = useRejectionReasons()
  const { teams } = useTeams()
  const teamOptions = useMemo(
    () => [{ value: 'none', label: t('tasks.noTeam') }, ...teams.map(tm => ({ value: tm.value, label: tm.label }))],
    [teams, t],
  )
  const taskTypePanelOptions = useMemo(
    () => [{ value: 'none', label: t('tasks.filters.typeNone') }, ...taskTypeOptions], [taskTypeOptions, t],
  )
  const taskPriorityPanelOptions = useMemo(
    () => [{ value: 'none', label: t('tasks.filters.priorityNone') }, ...taskPriorityOptions], [taskPriorityOptions, t],
  )
  const directionOptions = useMemo(
    () => (['inbound', 'outbound'] as const).map(v => ({ value: v, label: t(`whatsapp.axes.directionValues.${v}`) })), [t],
  )
  const originOptions = useMemo(
    () => [{ value: 'funnel', label: t('matches.viaFunnel') }, { value: 'direct', label: t('matches.direct') }], [t],
  )

  // Right-hand filter panel (DashboardLayout renders whatever is registered
  // here). The period group is universal — every `/reports/*` endpoint reads it
  // (see the file-top comment). `noChip` keeps the always-on period value out of
  // the removable-chip row (there is nothing honest to "remove" to — every report
  // always has a period). `buildReportQueryParams` shows, in one place, exactly
  // which of this state reaches the server — every group below is gated to the
  // exact report(s) whose backend rule set actually reads it (§ hard requirement:
  // a report must never show a field the server silently drops).
  const panelGroups: ReportFilterGroup[] = useMemo(() => {
    const groups: ReportFilterGroup[] = [{
      key: 'period',
      label: t('period.label'),
      type: 'radio',
      noChip: true,
      selected: [period],
      onToggle: (v: string | number) => setPeriod(String(v) as ReportPeriod),
      options: [
        { value: 'day', label: t('period.day') },
        { value: 'week', label: t('period.week') },
        { value: 'month', label: t('period.month') },
      ],
    }]
    // Compare group (RAPPORT-COMPARE-2) — radio like the period group; a custom
    // window adds the shared date-range group underneath. noChip mirrors period:
    // "off" is the empty state, the radio itself is the one honest control.
    if (compareInPanel) {
      groups.push({
        key: 'compare',
        label: t('compare.label'),
        type: 'radio',
        noChip: true,
        selected: [compareMode.kind],
        onToggle: (v: string | number) => {
          const kind = String(v)
          if (kind === 'previous_period') setCompareMode({ kind: 'previous_period' })
          else if (kind === 'previous_year') setCompareMode({ kind: 'previous_year' })
          else if (kind === 'custom') setCompareMode({ kind: 'custom', from: '', to: '' })
          else setCompareMode(COMPARE_OFF)
        },
        options: (['off', 'previous_period', 'previous_year', 'custom'] as const)
          .map(value => ({ value, label: t(`compare.mode.${value}`) })),
      })
      if (compareMode.kind === 'custom') {
        groups.push({
          key: 'compareRange',
          label: t('compare.mode.custom'),
          type: 'date-range',
          from: compareMode.from,
          to: compareMode.to,
          onFromChange: (v: string) => setCompareMode({ kind: 'custom', from: v, to: compareMode.kind === 'custom' ? compareMode.to : '' }),
          onToChange: (v: string) => setCompareMode({ kind: 'custom', from: compareMode.kind === 'custom' ? compareMode.from : '', to: v }),
        })
      }
    }
    if (filterable) {
      // Each report's own axis vocabulary for the status/owner labels — candidates/
      // customers keep their existing `<ns>.axes.*` pair; applications/tasks have
      // their own analytics.json axis labels; vacancies/matches/opportunities/
      // outreach have no dedicated axis label yet so they borrow the generic
      // `customers.axes.*` pair — the same fallback VacancyReportAxes already
      // uses for its own bars.
      const axisNs = active === 'customers' ? 'customers' : 'candidates'
      const statusLabel = active === 'customers' || active === 'candidates' ? t(`${axisNs}.axes.status`)
        : active === 'applications' ? t('applications.axes.bucket')
        : active === 'tasks' ? t('tasks.axes.status')
        : t('customers.axes.status')
      const ownerLabel = active === 'customers' || active === 'candidates' ? t(`${axisNs}.axes.owner`)
        : active === 'applications' ? t('applications.axes.owner')
        : active === 'tasks' ? t('tasks.axes.assignee')
        : active === 'whatsapp' ? t('whatsapp.axes.owner')
        : t('customers.axes.owner')
      const branchLabel = active === 'tasks' ? t('tasks.axes.branch') : t('common:filters.branch')
      // WHATSAPP-NARROW-1: whatsapp's own route drops status[]/location_id[] —
      // acceptsStatusBranch mirrors that so the panel never shows a dimension the
      // server would 422 or silently drop (reportFilterParams.ts).
      if (acceptsStatusBranch) {
        groups.push(
          {
            key: 'status', type: 'search-select', label: statusLabel,
            selected: status, onToggle: (v: string | number) => setStatus(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
            options: statusOptions,
          },
        )
      }
      groups.push({
        key: 'owner', type: 'search-select', label: ownerLabel,
        selected: ownerId, onToggle: (v: string | number) => setOwnerId(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
        options: ownerOptions,
      })
      if (acceptsStatusBranch) {
        groups.push({
          key: 'branch', type: 'search-select', label: branchLabel,
          selected: locationId, onToggle: (v: string | number) => setLocationId(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
          options: branchOptions,
        })
      }
      // customer_id[] only exists on the reports whose table actually carries a
      // customer/client FK (vacancies' client_id, applications' inherited via the
      // vacancy, opportunities' own customer_id) — see reportFilterParams.ts's
      // CUSTOMER_FILTERABLE_REPORT_IDS.
      if (acceptsCustomer) {
        groups.push({
          key: 'customer', type: 'search-select', label: t('applications.axes.customer'),
          selected: customerId, onToggle: (v: string | number) => setCustomerId(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
          options: customerOptions,
        })
      }
      // WAVE 1c: the per-page extra dimensions, gated to the exact report(s)
      // whose segmentQuery() reads them (mirrors buildReportQueryParams's own gate).
      if (active === 'candidates') {
        groups.push(
          { key: 'source', type: 'search-select', label: t('candidates.axes.source'),
            selected: source, onToggle: (v: string | number) => setSource(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: sourceOptions },
          { key: 'phase', type: 'search-select', label: t('candidates.axes.phase'),
            selected: phase, onToggle: (v: string | number) => setPhase(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: phaseOptions },
          { key: 'contractForm', type: 'search-select', label: t('candidates.axes.contractForm'),
            selected: contractForm, onToggle: (v: string | number) => setContractForm(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: contractFormOptions },
        )
      }
      if (active === 'applications') {
        groups.push(
          { key: 'stage', type: 'search-select', label: t('applications.axes.stage'),
            selected: stage, onToggle: (v: string | number) => setStage(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: stageOptions },
          { key: 'source', type: 'search-select', label: t('applications.axes.source'),
            selected: source, onToggle: (v: string | number) => setSource(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: sourceOptions },
          { key: 'rejectionReason', type: 'search-select', label: t('applications.axes.rejectionReason'),
            selected: rejectionReason, onToggle: (v: string | number) => setRejectionReason(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: rejectionReasonOptions },
          // vacancy_id[] stays UNWIRED: no shared vacancy-options lookup hook
          // exists today (a search-select over GET /vacancies?per_page=… is not
          // allowed per §4 — every filterable list already has its own combobox
          // hook, and building a new one is out of this wave's file list).
        )
      }
      if (active === 'matches') {
        groups.push(
          { key: 'customerIds', type: 'search-select', label: t('applications.axes.customer'),
            selected: customerIds, onToggle: (v: string | number) => setCustomerIds(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: customerOptions },
          { key: 'origin', type: 'search-select', label: t('matches.axes.origin'),
            selected: origin, onToggle: (v: string | number) => setOrigin(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: originOptions },
          { key: 'contractForm', type: 'search-select', label: t('matches.axes.contractForm'),
            selected: contractForm, onToggle: (v: string | number) => setContractForm(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: contractFormOptions },
          // stop_reason is deliberately NOT a panel group: MatchesReport::
          // applyMatchDimensionFilters() does not apply it to the envelope (its
          // docblock says so), so a picker here would change nothing (§3 no fake
          // affordance) — filed with CMBE.
        )
      }
      if (active === 'tasks') {
        groups.push(
          { key: 'taskType', type: 'search-select', label: t('tasks.axes.type'),
            selected: taskType, onToggle: (v: string | number) => setTaskType(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: taskTypePanelOptions },
          { key: 'priority', type: 'search-select', label: t('tasks.axes.priority'),
            selected: priority, onToggle: (v: string | number) => setPriority(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: taskPriorityPanelOptions },
          { key: 'team', type: 'search-select', label: t('tasks.axes.team'),
            selected: teamId, onToggle: (v: string | number) => setTeamId(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: teamOptions },
        )
      }
      if (active === 'whatsapp') {
        groups.push(
          { key: 'direction', type: 'search-select', label: t('whatsapp.axes.direction'),
            selected: direction, onToggle: (v: string | number) => setDirection(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]), options: directionOptions },
          { key: 'escalated', type: 'radio', label: t('whatsapp.axes.escalated'), noChip: escalated === null,
            selected: [escalated === null ? 'any' : escalated ? 'true' : 'false'],
            onToggle: (v: string | number) => setEscalated(v === 'any' ? null : v === 'true'),
            options: [
              { value: 'any', label: t('whatsapp.axes.escalatedAny') },
              { value: 'true', label: t('common:yes') },
              { value: 'false', label: t('common:no') },
            ] },
        )
      }
      if (active === 'opportunities') {
        groups.push({
          key: 'value', type: 'number-range', label: t('opportunities.axes.value'),
          min: valueMin, max: valueMax,
          onMinChange: (v: number | null) => setValueMin(v), onMaxChange: (v: number | null) => setValueMax(v),
        })
      }
    }
    return groups
  }, [t, period, filterable, active, status, ownerId, locationId, customerId, acceptsCustomer, acceptsStatusBranch,
    statusOptions, ownerOptions, branchOptions, customerOptions, compareInPanel, compareMode,
    source, phase, contractForm, stage, rejectionReason, taskType, priority, teamId, direction, escalated,
    customerIds, origin, valueMin, valueMax,
    sourceOptions, phaseOptions, contractFormOptions, stageOptions, rejectionReasonOptions,
    taskTypePanelOptions, taskPriorityPanelOptions, teamOptions, directionOptions, originOptions])

  useEffect(() => {
    registerFilters('reports-page', panelGroups)
    return () => unregisterFilters('reports-page')
  }, [panelGroups, registerFilters, unregisterFilters])

  return (
    <div className="p-6">
      {/* Bare root → the KPI overview dashboard; a real sub-route id → its report,
          unchanged (RAPPORTEN-DASHBOARD-1). Both read `period` from the right
          panel above (registerFilters), never from an inline toolbar control. */}
      {isRoot
        ? <ReportsDashboard period={period} />
        : <Report period={period} filters={filterable ? filters : undefined} initialView={initialView} compare={compareInPanel ? compareMode : undefined} />}
    </div>
  )
}
