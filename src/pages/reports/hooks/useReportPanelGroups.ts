/**
 * useReportPanelGroups — owns the right-hand filter panel for ReportsPage
 * (extracted from ReportsPage.tsx, §3: > ~400 lines = split). Holds every
 * panel-driven filter dimension's state, the lookup sources that feed their
 * option lists, the compare radio/date-range groups, the reset-on-report-switch
 * effect, and the group assembly + its registration into RightPanelContext.
 * Returns the `filters` object the active report's own hook/drill reads —
 * ReportsPage stays a thin container that only resolves the active report and
 * renders it.
 */
import { useEffect, useMemo, useState } from 'react'
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
} from '../reportStatusLookups'
import { isFilterableReport, CUSTOMER_FILTERABLE_REPORT_IDS, acceptsStatusBranchFilter } from '../reportFilterParams'
import { COMPARE_OFF } from '../reportCompareMode'
import type { ReportCompareMode } from '../reportCompareMode'
import type { ReportFilterState } from '../reportFilterParams'
import type { ReportFilterGroup } from '@/types/reports'
import type { ReportId } from '../reportIds'
import type { ReportPeriod } from '@/types/analytics'

export function useReportPanelGroups({ active, period, setPeriod, compareInPanel, compareMode, setCompareMode }: {
  active: ReportId
  period: ReportPeriod
  setPeriod: (p: ReportPeriod) => void
  compareInPanel: boolean
  compareMode: ReportCompareMode
  setCompareMode: (m: ReportCompareMode) => void
}): { filters: ReportFilterState; filterable: boolean } {
  const { t } = useTranslation('analytics')
  const { registerFilters, unregisterFilters } = useRightPanel()
  const filterable = isFilterableReport(active)

  // RAPPORT-FILTERS-1/2: status/owner/branch(+customer), wired for every report on
  // FILTERABLE_REPORT_IDS. The panel and both hooks read this exact same state — a
  // report's own hook and its drilldown build request params from this one object
  // via `buildReportQueryParams`, so bar and lade can never disagree.
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
  // LOOKUP-I18N-1: useApplicationSources already returns { value, label } rows
  // (value = raw backend name for the filter param, label = translated display) —
  // no local remap needed any more.
  const { sources: sourceOptions } = useApplicationSources()
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
  // here). The period group is universal — every `/reports/*` endpoint reads it.
  // `noChip` keeps the always-on period value out of the removable-chip row
  // (there is nothing honest to "remove" to — every report always has a period).
  // `buildReportQueryParams` shows, in one place, exactly which of this state
  // reaches the server — every group below is gated to the exact report(s)
  // whose backend rule set actually reads it (a report must never show a field
  // the server silently drops).
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
    taskTypePanelOptions, taskPriorityPanelOptions, teamOptions, directionOptions, originOptions,
    setPeriod, setCompareMode])

  // Registration into the shared right panel — the same panel every other page
  // renders through. Unregisters on unmount so the panel never shows a stale group.
  useEffect(() => {
    registerFilters('reports-page', panelGroups)
    return () => unregisterFilters('reports-page')
  }, [panelGroups, registerFilters, unregisterFilters])

  return { filters, filterable }
}
