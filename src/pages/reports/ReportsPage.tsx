/**
 * ReportsPage — thin router for the analytical reports (B-28, RAPPORTEN-OMBOUW-1).
 * The old inner tab bar is GONE (Danny 13-08: every report is its own sub-page,
 * reached from the sidebar's Rapporten submenu). This shell only resolves the
 * active report from the route key handed down by appPages (#reports.<id>) and
 * renders it full-page.
 *
 * Right-hand filter panel (Danny 14-08: "elke pagina wordt een dashboardpagina
 * met filtermenu rechts"). Every report registers ONE group into the shared
 * `RightPanelContext` — the same panel DashboardLayout already renders for every
 * other page (§0 consistency) — with ONLY the period, the one filter the
 * `/reports/*` endpoints actually read today. No other dimension is registered:
 * the server ignores anything but `period`/`from`/`to`/`bucket`, so a group that
 * LOOKED like a real filter here would silently do nothing (an honesty finding).
 * `buildReportQueryParams` (./reportFilterParams, own unit test) is the single
 * seam that turns panel state into request params — enabling a real server-side
 * filter later is one line there, not a new param sprinkled across 17 report
 * hooks. Each report's own `use<X>Report` hook still builds its own `api.get`
 * call unchanged; this page only owns the panel and the period it feeds.
 *
 * RIGHTPANEL-FILTERS-1 (2026-08-14, Danny: "rode filters moeten naar rechts
 * filter menu"): the inline period `CreatableSelect` that used to travel down
 * through a `tabsSlot` prop into every report's own toolbar row is GONE — it was
 * an exact duplicate of the `period` group already registered below (both drove
 * the same `period` state), the same "two doors, one room" pattern the matches
 * page toolbar had. The panel is now the ONLY place `period` is picked; every
 * report component had its now-unused `tabsSlot` prop removed to match.
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
import { useCustomerOptions } from '@/pages/vacancies/hooks/useCustomerOptions'
import { useVacancyStatusIdOptions, useTaskStatusIdOptions } from './reportStatusLookups'
import { isFilterableReport, CUSTOMER_FILTERABLE_REPORT_IDS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { ReportFilterGroup } from '@/types/reports'
import CandidatesReport from './CandidatesReport'
import LeadsReport from './LeadsReport'
import ApplicationsReport from './ApplicationsReport'
import CustomersReport from './CustomersReport'
import FlowReport from './FlowReport'
import RecruitersReport from './RecruitersReport'
import AccountManagersReport from './AccountManagersReport'
import VacanciesReport from './VacanciesReport'
import OpportunitiesReport from './OpportunitiesReport'
import TasksReport from './TasksReport'
import MatchesReport from './MatchesReport'
import IntakesReport from './IntakesReport'
import OutreachReport from './OutreachReport'
import SourcesReport from './SourcesReport'
import ContactsReport from './ContactsReport'
import LocationsReport from './LocationsReport'
import DepartmentsReport from './DepartmentsReport'
import AiReport from './AiReport'
import WorkflowsReport from './WorkflowsReport'
import ReportsDashboard from './ReportsDashboard'
import { REPORT_IDS } from './reportIds'
import type { ReportId } from './reportIds'
import type { ReportPeriod } from '@/types/analytics'

// Every report takes the same contract: the chosen period + the optional filters.
// `filters` is optional and only READ by the two reports on FILTERABLE_REPORT_IDS
// (CandidatesReport/CustomersReport) — every other report ignores the prop.
type ReportComponent = ComponentType<{ period: ReportPeriod; filters?: ReportFilterState }>

// Registry: report id → component. Ids and their order live in reportIds.ts
// (shared with the sidebar submenu); an id here without a REPORT_IDS entry — or
// vice versa — is a wiring bug the exhaustive Record type surfaces at compile time.
const REPORTS: Record<ReportId, ReportComponent> = {
  candidates:    CandidatesReport,
  leads:         LeadsReport,
  applications:  ApplicationsReport,
  customers:     CustomersReport,
  flow:          FlowReport,
  recruiters:    RecruitersReport,
  accountmanagers: AccountManagersReport,
  vacancies:     VacanciesReport,
  opportunities: OpportunitiesReport,
  tasks:         TasksReport,
  matches:       MatchesReport,
  intakes:       IntakesReport,
  outreach:      OutreachReport,
  sources:       SourcesReport,
  contacts: ContactsReport,
  locations: LocationsReport,
  departments: DepartmentsReport,
  ai: AiReport,
  workflows: WorkflowsReport,
}

export default function ReportsPage({ reportId }: { reportId?: string }) {
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

  // RAPPORT-FILTERS-1/2: status/owner/branch(+customer), wired for every report on
  // FILTERABLE_REPORT_IDS. Kept here, not per-report, so the panel and both hooks
  // read the exact same state — a report's own hook and its drilldown build their
  // request params from this one object via `buildReportQueryParams`, so bar and
  // lade can never disagree.
  const [status, setStatus] = useState<Array<string | number>>([])
  const [ownerId, setOwnerId] = useState<Array<string | number>>([])
  const [locationId, setLocationId] = useState<Array<string | number>>([])
  const [customerId, setCustomerId] = useState<Array<string | number>>([])
  const filters: ReportFilterState = useMemo(() => ({ status, ownerId, locationId, customerId }), [status, ownerId, locationId, customerId])
  const acceptsCustomer = (CUSTOMER_FILTERABLE_REPORT_IDS as readonly string[]).includes(active)

  // Reset every dimension when navigating to a report that doesn't read them (or
  // off one that does) — a stale selection must never linger invisibly.
  useEffect(() => {
    if (!filterable) { setStatus([]); setOwnerId([]); setLocationId([]); setCustomerId([]) }
  }, [filterable])

  // Lookup sources for the filter options — each entity keeps its OWN status
  // vocabulary (deployability/vacancy lifecycle/funnel bucket/match state/task
  // board), while owner (users) and branch (locations) are shared tenant lookups.
  // Vacancy/task statuses are validated by the backend against their raw lookup
  // ID, never the slug (see reportStatusLookups.ts) — a dedicated fetch, not the
  // page-scoped VacancyLookupsContext/TaskLookupsContext (unmounted here).
  const { statuses: candidateStatuses } = useLookups()
  const { statuses: customerStatuses } = useCustomerLookups()
  const { data: users = [] } = useUsers() as { data?: Array<{ id?: string | number; name?: string }> }
  const locations = useLocations()
  const vacancyStatusOptions = useVacancyStatusIdOptions()
  const taskStatusOptions = useTaskStatusIdOptions()
  const { statuses: matchStatusesRaw } = useMatchStatuses()
  const matchStatusOptions = useMemo(() => matchStatusesRaw.map(s => ({ value: s.value, label: s.label })), [matchStatusesRaw])
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
    : candidateStatuses
  const ownerOptions = useMemo(() => users.map(u => ({ value: u.id ?? '', label: u.name || '—' })).filter(o => o.value !== ''), [users])
  const branchOptions = useMemo(() => locations.map(l => ({ value: l.value, label: l.label })), [locations])

  // Right-hand filter panel (DashboardLayout renders whatever is registered
  // here). The period group is universal — the only dimension every `/reports/*`
  // endpoint reads (see the file-top comment). `noChip` keeps the always-on period
  // value out of the removable-chip row (there is nothing honest to "remove" to —
  // every report always has a period). `buildReportQueryParams` shows, in one
  // place, exactly which of this state reaches the server. Status/owner/branch
  // are appended ONLY on `candidates`/`customers` (§ hard requirement: the other
  // twelve reports must never show a field the server silently drops).
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
    if (filterable) {
      // Each report's own axis vocabulary for the status/owner labels — candidates/
      // customers keep their existing `<ns>.axes.*` pair; applications/tasks have
      // their own analytics.json axis labels; vacancies/matches have no dedicated
      // axis label yet so they borrow the generic `customers.axes.*` pair — the
      // same fallback VacancyReportAxes already uses for its own bars.
      const axisNs = active === 'customers' ? 'customers' : 'candidates'
      const statusLabel = active === 'customers' || active === 'candidates' ? t(`${axisNs}.axes.status`)
        : active === 'applications' ? t('applications.axes.bucket')
        : active === 'tasks' ? t('tasks.axes.status')
        : t('customers.axes.status')
      const ownerLabel = active === 'customers' || active === 'candidates' ? t(`${axisNs}.axes.owner`)
        : active === 'applications' ? t('applications.axes.owner')
        : active === 'tasks' ? t('tasks.axes.assignee')
        : t('customers.axes.owner')
      const branchLabel = active === 'tasks' ? t('tasks.axes.branch') : t('common:filters.branch')
      groups.push(
        {
          key: 'status', type: 'search-select', label: statusLabel,
          selected: status, onToggle: (v: string | number) => setStatus(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
          options: statusOptions,
        },
        {
          key: 'owner', type: 'search-select', label: ownerLabel,
          selected: ownerId, onToggle: (v: string | number) => setOwnerId(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
          options: ownerOptions,
        },
        {
          key: 'branch', type: 'search-select', label: branchLabel,
          selected: locationId, onToggle: (v: string | number) => setLocationId(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
          options: branchOptions,
        },
      )
      // customer_id[] only exists on the two reports whose table actually carries
      // a customer/client FK (vacancies' client_id, applications' inherited via
      // the vacancy) — see reportFilterParams.ts's CUSTOMER_FILTERABLE_REPORT_IDS.
      if (acceptsCustomer) {
        groups.push({
          key: 'customer', type: 'search-select', label: t('applications.axes.customer'),
          selected: customerId, onToggle: (v: string | number) => setCustomerId(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]),
          options: customerOptions,
        })
      }
    }
    return groups
  }, [t, period, filterable, active, status, ownerId, locationId, customerId, acceptsCustomer,
    statusOptions, ownerOptions, branchOptions, customerOptions])

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
        : <Report period={period} filters={filterable ? filters : undefined} />}
    </div>
  )
}
