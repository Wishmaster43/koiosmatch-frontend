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
 * call unchanged; the panel state itself, its lookup sources, and its
 * registration into RightPanelContext live in `hooks/useReportPanelGroups.ts`
 * (extracted from this file, §3: > ~400 lines = split) — this page only resolves
 * the active report and renders it.
 *
 * RIGHTPANEL-FILTERS-1 (2026-08-14, Danny: "rode filters moeten naar rechts
 * filter menu"): the inline period `CreatableSelect` that used to travel down
 * through a `tabsSlot` prop into every report's own toolbar row is GONE — it was
 * an exact duplicate of the `period` group already registered by the panel hook
 * (both drove the same `period` state), the same "two doors, one room" pattern
 * the matches page toolbar had. The panel is now the ONLY place `period` is
 * picked; every report component had its now-unused `tabsSlot` prop removed to
 * match.
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
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { useReportPanelGroups } from './hooks/useReportPanelGroups'
import { reportSupportsCompare } from './reportCompareSupport'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import type { ReportFilterState } from './reportFilterParams'
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

// A dashboard chart's click intent — the SAME `report` id vocabulary the
// reports.<id> hash route uses (reportIds.ts), so a tile navigating with
// onNavigate('reports', { report: 'vacancies' }) selects that report exactly
// as a click on the reports sidebar submenu would (DASH-REPORT-DEEPLINK-1).
export interface ReportsPageIntent { report?: string }

// Resolves which report (or the root dashboard) to render from the route/intent,
// and owns the period/compare state shared by every report body.
export default function ReportsPage({ reportId, initialView, intent }: { reportId?: string; initialView?: string; intent?: ReportsPageIntent }) {
  const [period, setPeriod] = useState<ReportPeriod>('month')

  // The explicit route id (from the reports.<id> hash route) wins; a bare
  // #reports arriving with an intent { report } falls back to that instead
  // of the dashboard, so a chart click lands on the right sub-report.
  const requestedId = reportId ?? intent?.report
  // A bare #reports (no reportId/intent) is now its own KPI overview dashboard
  // (RAPPORTEN-DASHBOARD-1) — it no longer forwards to the first sub-report.
  // Only an UNKNOWN id (a genuinely stale deep-link) still falls back to the
  // first report; the root itself renders the dashboard branch below.
  const isRoot = requestedId == null
  const active: ReportId = isRoot
    ? REPORT_IDS[0]
    : (REPORT_IDS as readonly string[]).includes(requestedId)
      ? (requestedId as ReportId)
      : REPORT_IDS[0]
  const Report = REPORTS[active]

  // RAPPORT-COMPARE-2: compare lives in the right panel for EVERY supporting
  // report (the per-page toolbar controls are deleted — §4: one filtering
  // surface). The mode resets when the user switches reports, so one page's
  // comparison never leaks into the next page's numbers.
  const [compareMode, setCompareMode] = useState<ReportCompareMode>(COMPARE_OFF)
  // Resets compare mode whenever the active report changes (see comment above).
  useEffect(() => { setCompareMode(COMPARE_OFF) }, [active])
  const compareInPanel = !isRoot && reportSupportsCompare(active)

  // RAPPORT-FILTERS-1..2/1c: the entire right-hand filter panel — its state,
  // its lookup option sources, the compare radio/date-range groups, the
  // reset-on-report-switch effect and the registration itself — is owned by
  // this hook (hooks/useReportPanelGroups.ts, §3 extracted at > ~400 lines).
  const { filters, filterable } = useReportPanelGroups({ active, period, setPeriod, compareInPanel, compareMode, setCompareMode })

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
