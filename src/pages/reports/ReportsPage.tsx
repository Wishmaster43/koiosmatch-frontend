/**
 * ReportsPage — thin router for the analytical reports (B-28, RAPPORTEN-OMBOUW-1).
 * The old inner tab bar is GONE (Danny 13-08: every report is its own sub-page,
 * reached from the sidebar's Rapporten submenu). This shell only resolves the
 * active report from the route key handed down by appPages (#reports.<id>) and
 * renders it full-page. The shared period control still travels through the
 * existing `tabsSlot` seam so every report keeps its props and layout unchanged.
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
 */
import { useEffect, useId, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import type { ReportFilterGroup } from '@/types/reports'
import CandidatesReport from './CandidatesReport'
import ApplicationsReport from './ApplicationsReport'
import CustomersReport from './CustomersReport'
import FlowReport from './FlowReport'
import RecruitersReport from './RecruitersReport'
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
import CreatableSelect from '@/components/ui/CreatableSelect'
import ReportsDashboard from './ReportsDashboard'
import { REPORT_IDS } from './reportIds'
import type { ReportId } from './reportIds'
import type { ReportPeriod } from '@/types/analytics'

// Every report takes the same contract: the chosen period + the pass-through slot.
type ReportComponent = ComponentType<{ period: ReportPeriod; tabsSlot?: ReactNode }>

// Registry: report id → component. Ids and their order live in reportIds.ts
// (shared with the sidebar submenu); an id here without a REPORT_IDS entry — or
// vice versa — is a wiring bug the exhaustive Record type surfaces at compile time.
const REPORTS: Record<ReportId, ReportComponent> = {
  candidates:    CandidatesReport,
  applications:  ApplicationsReport,
  customers:     CustomersReport,
  flow:          FlowReport,
  recruiters:    RecruitersReport,
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
  // Names the period picker for the button-based CreatableSelect below (a <button>
  // isn't labelable by htmlFor — see the component's own doc comment).
  const periodLabelId = useId()
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

  // Shared period control, top-right. Passed through `tabsSlot` so each report
  // keeps rendering it under its KPI row without any prop change on its side.
  const periodBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
      <span id={periodLabelId}>{t('period.label')}</span>
      {/* Searchable combobox replaces the bare native <select> (Danny 08-08, §4) —
          allowCreate=false since the period is a fixed, non-creatable vocabulary. */}
      <CreatableSelect
        aria-labelledby={periodLabelId}
        value={period}
        onChange={v => setPeriod(v as ReportPeriod)}
        allowCreate={false}
        menuWidth={140}
        options={[
          { value: 'day', label: t('period.day') },
          { value: 'week', label: t('period.week') },
          { value: 'month', label: t('period.month') },
        ]}
        style={{ height: 30, padding: '0 8px', fontSize: 13 }}
      />
    </div>
  )

  // Right-hand filter panel (DashboardLayout renders whatever is registered
  // here). ONE group, the period — the only dimension `/reports/*` reads
  // today (see the file-top comment). `noChip` keeps the always-on period
  // value out of the removable-chip row (there is nothing honest to "remove"
  // to — every report always has a period). `buildReportQueryParams` shows,
  // in one place, exactly which of this group's state reaches the server.
  const panelGroups: ReportFilterGroup[] = useMemo(() => [{
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
  }], [t, period])

  useEffect(() => {
    registerFilters('reports-page', panelGroups)
    return () => unregisterFilters('reports-page')
  }, [panelGroups, registerFilters, unregisterFilters])

  return (
    <div className="p-6">
      {/* Bare root → the KPI overview dashboard; a real sub-route id → its report,
          unchanged (RAPPORTEN-DASHBOARD-1). Both still get the shared period bar. */}
      {isRoot
        ? <ReportsDashboard period={period} tabsSlot={periodBar} />
        : <Report period={period} tabsSlot={periodBar} />}
    </div>
  )
}
