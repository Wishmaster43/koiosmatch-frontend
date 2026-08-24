/**
 * Dashboard templates (B-27) — per role: which KPI row (KPI_ROWS) and which charts/
 * lists (DASHBOARD_TEMPLATES, gated via `visibleBlock`). Every role ALWAYS gets a
 * full, role-specific KPI row; `['*']` = show every chart/list (admin/management).
 *
 * The `dashboard_type` enum is OWNED BY THE BACKEND (C-35) and is leading — these
 * are the confirmed values (docs/plans/DASHBOARD-PLAN.md): never diverge. `/auth/me`
 * returns roles[].dashboard_type.
 */
// KD11 (DASHP36, 2026-08-13) — two new sales-dashboard roles: `accountmanager`
// (own-customer scope) and `sales_manager` (tenant-wide customer dimension +
// the `customers_by_owner` breakdown). Server-resolved scoping, see CONTRACT-CHANGELOG.
// DASHBOARD-KIEZER-1 (Danny 2026-08-14) — `recruitment_manager` is NEW: the
// team-wide manager view over the recruitment KPI set (own-scope `recruitment`
// stays the individual recruiter's dashboard, mirroring accountmanager/sales_manager).
export const DASHBOARD_TYPES = ['admin', 'management', 'recruitment', 'recruitment_manager', 'backoffice', 'sales', 'accountmanager', 'sales_manager', 'planning', 'readonly'] as const
export type DashboardType = typeof DASHBOARD_TYPES[number]

// Multi-role users: the richest dashboard wins. Manager variants precede their
// own-scope counterpart (recruitment_manager > recruitment, sales_manager > sales).
export const TYPE_PRECEDENCE: DashboardType[] = ['admin', 'management', 'recruitment_manager', 'recruitment', 'backoffice', 'sales_manager', 'sales', 'accountmanager', 'planning', 'readonly']

// Types allowed to switch/preview every role's view (see everything).
export const SUPER_VIEWS: DashboardType[] = ['admin', 'management']

// DASHBOARD-KIEZER-1 — types a user may manually PICK from the switcher dropdown.
// admin/sales/readonly stay resolvable (TYPE_PRECEDENCE) but are not chooser options
// (Danny 14-08: they clutter the list); `planning` only appears when the tenant has
// the planning module (mirrors the `block.shifts` gate in Dashboard.tsx/useDashboardViewModel).
const SWITCHER_EXCLUDED: DashboardType[] = ['admin', 'sales', 'readonly']
export const switcherTypes = (hasPlanning: boolean): DashboardType[] =>
  DASHBOARD_TYPES.filter(t => !SWITCHER_EXCLUDED.includes(t) && (t !== 'planning' || hasPlanning))

// ── KPI row per role — bare KPI ids resolved in Dashboard.tsx (kpiById). Every role
// shows a full, role-specific row (never hidden). 🟡 metrics render "—" until the
// backend feed lands (see docs/plans/DASHBOARD-PLAN.md).
// NEGEN-PER-ROL (Danny 24-08, herhaald en definitief: "9 KPI rows met
// relevante KPI's" voor ÁLLE rollen — gemeten stand ervoor: backoffice 6,
// sales 6, accountmanager 5, planning 4, readonly 3). Rows follow the decided
// role plan (PLAN-DASHBOARD-PER-ROL-V2 §2) using the full K-168/K-173 tile
// vocabulary; the same nine per role go to CMBE as the server role-defaults so
// kpi_row and this fallback can never disagree.
export const KPI_ROWS: Record<DashboardType, string[]> = {
  admin:       ['candidates', 'opps', 'pipeline', 'expiringOpps', 'placements', 'intakes', 'openVacancies', 'tasksOverdue', 'activeConv'],
  management:  ['candidates', 'opps', 'pipeline', 'expiringOpps', 'placements', 'intakes', 'openVacancies', 'tasksOverdue', 'activeConv'],
  // Recruiter: own book (server-scoped) — inflow, attention, intakes, pipeline-to-placement.
  recruitment: ['candidates', 'candidatesNew', 'stale', 'never', 'noFollowup', 'intakes', 'tooLongInStage', 'tasks', 'placements'],
  // Team-wide recruitment oversight: the same axes as the recruiter, plus the
  // escalation/fill signals a manager steers on (plan §2).
  recruitment_manager: ['candidates', 'candidatesNew', 'intakes', 'tooLongInStage', 'escalations', 'fillRate', 'openVacancies', 'tasksOverdue', 'placements'],
  // Backoffice (Danny 24-08: "gaat over de uitvoeringen"): the EXECUTION nine —
  // running placements + new placements, contract/document administration,
  // coupling health and the workflow runs; call lists left (recruiter work).
  backoffice:  ['matchesTotal', 'placements', 'expiringContracts', 'missingDocs', 'couplingErrors', 'incompleteRuns', 'failedWf', 'tasks', 'tasksOverdue'],
  sales:       ['leadsPipeline', 'opps', 'pipeline', 'expiringOpps', 'fillRate', 'expiringContracts', 'vacanciesActive', 'activeConv', 'placements'],
  // KD11 — own-customer scope (server-resolved); the customer-portfolio nine.
  accountmanager: ['leadsPipeline', 'opps', 'pipeline', 'expiringOpps', 'fillRate', 'expiringContracts', 'vacanciesActive', 'placements', 'tasks'],
  // KD11 — tenant-wide over the customer dimension (richest sales view).
  sales_manager:  ['leadsPipeline', 'opps', 'pipeline', 'expiringOpps', 'fillRate', 'expiringContracts', 'vacanciesActive', 'escalations', 'placements'],
  // Planning: the shifts operation — coverage first, then the automation health
  // that feeds it. (Server-side this type still shares the 'default' row; the
  // dedicated 'planning' role default is requested at CMBE.)
  planning:    ['shiftsPlanned', 'openShifts', 'occupancy', 'incompleteRuns', 'failedWf', 'tasks', 'tasksOverdue', 'matchesTotal', 'expiringContracts'],
  readonly:    ['candidates', 'opps', 'pipeline', 'expiringOpps', 'placements', 'intakes', 'openVacancies', 'tasksOverdue', 'activeConv'],
}

// ── Charts/lists per role. '*' = everything (admin/management = full dashboard).
export const DASHBOARD_TEMPLATES: Record<DashboardType, string[]> = {
  admin: ['*'],
  management: ['*'],
  recruitment: ['chart.status', 'chart.funnel', 'chart.funnelConversion', 'chart.weekly', 'list.candidates', 'list.applications', 'list.conversations', 'list.runs'],
  // DASHBOARD-OPRUIMING-1 (Danny 23-08): "recruitment_manager mirrors management
  // verbatim" — same '*' wildcard, same full dashboard, instead of its own trimmed
  // block list.
  recruitment_manager: ['*'],
  backoffice: ['chart.status', 'chart.funnel', 'list.applications', 'list.runs'],
  sales: ['chart.oppStage', 'chart.status', 'list.leads'],
  // KD11 — the two sales-dashboard TEMPLATES on the DASHP36 widget-feed keys
  // (expiring_matches/stale_vacancies/koios_suggestions), equal footprint via the
  // shared WidgetListBlock (config-driven, §3A). `sales_manager` additionally
  // gets the tenant-wide `customers_by_owner` breakdown.
  // K-173 fase 6 — block.oppAging (ageing buckets) on both sales views.
  accountmanager: ['chart.oppStage', 'chart.status', 'list.leads', 'block.expiringMatches', 'block.staleVacancies', 'block.koiosSuggestions', 'block.oppAging'],
  sales_manager:  ['chart.oppStage', 'chart.status', 'list.leads', 'block.expiringMatches', 'block.staleVacancies', 'block.koiosSuggestions', 'block.customersByOwner', 'block.oppAging'],
  planning: ['block.shifts', 'chart.weekly', 'list.runs', 'list.conversations'],
  readonly: ['chart.status', 'chart.funnel'],
}

// ── Id → i18n label key (namespace `dashboard`). Single source shared by the
// Settings → Dashboards preview so it never re-hardcodes labels.
export const KPI_LABEL_KEY: Record<string, string> = {
  candidates: 'kpi.candidatesTotal', stale: 'kpi.notContacted6m', never: 'kpi.neverContacted',
  tasks: 'kpi.openTasks', opps: 'kpi.opportunities', pipeline: 'kpi.pipelineValue',
  placements: 'kpi.placements', intakes: 'kpi.intakes', fillRate: 'kpi.fillRate',
  incompleteRuns: 'kpi.incompleteRuns',
  activeConv: 'kpi.activeConv', missingDocs: 'kpi.missingDocs', expiringContracts: 'kpi.expiringContracts',
  couplingErrors: 'kpi.couplingErrors', openShifts: 'kpi.openShifts', occupancy: 'kpi.occupancy',
  escalations: 'kpi.escalations', failedWf: 'kpi.failedWf', tasksOverdue: 'kpi.tasksOverdue',
  uncalledCallist: 'kpi.uncalledCallist', expiringOpps: 'kpi.expiringOpps',
  // Was missing — Settings → Dashboards fell back to the raw id ("openVacancies")
  // instead of the translated label used by the live dashboard (dashboardKpis.tsx).
  openVacancies: 'kpi.openVacancies',
  // D6 — new attention tiles (P36 fase 1).
  tooLongInStage: 'kpi.tooLongInStage', missingApptApps: 'kpi.missingApptApps',
}
export const BLOCK_LABEL_KEY: Record<string, string> = {
  'chart.status': 'chart.byStatus', 'chart.funnel': 'chart.funnel', 'chart.funnelConversion': 'chart.funnelConversion',
  // Was missing (DASHBOARD-KIEZER-1) — since recruitment_manager went '*' no
  // template lists 'chart.recruiter' explicitly; it lives on via this catalog
  // (wildcard renders Object.keys here), so its label entry must stay or the raw
  // id leaks as the row label (the exact class of bug openVacancies hit before).
  'chart.recruiter': 'chart.byRecruiter',
  'chart.weekly': 'chart.intakeWeekly', 'chart.oppStage': 'chart.byStage',
  'list.candidates': 'block.recentCandidates', 'list.applications': 'block.recentApplications',
  'list.conversations': 'block.recentConversations', 'list.runs': 'block.recentRuns', 'list.leads': 'block.leadsPipeline',
  'block.shifts': 'block.shifts',
  // KD11 widget feeds (DASHP36).
  'block.expiringMatches': 'block.expiringMatches',
  'block.staleVacancies': 'block.staleVacancies', 'block.koiosSuggestions': 'block.koiosSuggestions',
  'block.customersByOwner': 'block.customersByOwner',
  // K-173 fase 6 — recruitment_manager team load + sales ageing buckets.
  'block.recruiterLoad': 'block.recruiterLoad',
  'block.oppAging': 'block.oppAging',
}

// Is a chart/list block visible for the active dashboard type?
export const visibleBlock = (type: string, id: string): boolean => {
  const tpl = DASHBOARD_TEMPLATES[type as DashboardType] ?? ['*']
  return tpl.includes('*') || tpl.includes(id)
}

// KPI ids for the active type (fallback to management's row).
export const kpiRow = (type: string): string[] =>
  KPI_ROWS[type as DashboardType] ?? KPI_ROWS.management

// May this type switch/preview every dashboard view?
export const canSwitchViews = (type: string): boolean => SUPER_VIEWS.includes(type as DashboardType)

// Resolve the effective type from a user's roles (richest wins; readonly fallback).
export const resolveDashboardType = (types: string[]): DashboardType => {
  for (const t of TYPE_PRECEDENCE) if (types.includes(t)) return t
  return 'readonly'
}
