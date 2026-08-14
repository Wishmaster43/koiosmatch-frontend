/**
 * kpiCatalog — the data-independent manifest behind the "which nine KPI cards"
 * settings screen (RAPPORT-KPI-INSTELBAAR). Two families exist, mirrored from how
 * each report already builds its strip (never a second hand-maintained list):
 *
 * - `family: 'axis'` (candidates, leads, applications, customers, prospects) — cards
 *   2-9 are derived live per-tenant by `buildAxisKpis` from the report's own axis
 *   segments (the SPECIFIC top segment is data-dependent, so it can't be a stable
 *   catalogue entry). What IS stable and pickable is the axis itself — its id and
 *   order. Card 1 ("total") stays pinned; it is not part of the catalogue.
 * - `family: 'fixed'` — every other report's nine cards are a literal, hand-written
 *   array today. The catalogue entry IS that literal card (key + i18n label ref),
 *   copied here without touching the report's own compute logic. All catalogue
 *   entries here equal the report's current default order — there are no spare
 *   cards to swap in yet (only reordering is meaningfully different from today);
 *   `hasSpareCards` says so explicitly so the settings screen can be honest about
 *   it instead of showing a picker that can only ever pick what's already there.
 *
 * SCOPE IDS vs. ROUTE IDS (RAPPORTEN-CONSOLIDATIE-1, 2026-08-14): a KPI catalogue
 * entry is keyed by `ReportKpiScopeId`, a SUPERSET of the route-level `ReportId`.
 * Merging nineteen sidebar entries into thirteen pages (§ reportIds.ts) retired
 * several ids as their own ROUTE, but every one of them keeps its OWN independent
 * catalogue + settings key here — a switch position is a full population/entity,
 * not a lesser view, so a tenant's per-position KPI order must never collide with
 * its sibling position's. Concretely: 'leads' and 'prospects' are NEW/kept axis
 * scopes (Instroom's Leads switch, Klanten's new Prospects switch) even though
 * neither is a route id any more; 'recruiters'/'accountmanagers' (now switch
 * positions on the 'people' route) and 'contacts'/'locations'/'departments' (now
 * switch positions on the 'customerstructure' route) and 'ai'/'workflows' (now
 * switch positions on the 'usage' route) keep their catalogues byte-identical to
 * before the merge — nothing lost, nothing duplicated. The ONE id that does NOT
 * survive as a scope is 'sources': it never had a switch position of its own (its
 * whole page folded into Instroom's pre-existing Source axis card, see
 * reportIds.ts), so `report_kpis_sources` is now orphaned/inert — no screen reads
 * or writes it any more (a tenant who had customised it loses nothing visible,
 * since the Sources page itself is gone; the stray settings key is harmless dead
 * data, left in place rather than migrated since there is nowhere left to move it).
 *
 * i18n: every `labelKey` below already exists in the `analytics` namespace (lifted
 * verbatim from the report that owns it) — no new translation work for the
 * catalogue itself; only the new Settings screen chrome needs fresh keys.
 */
import type { ReportId } from './reportIds'

export interface KpiCatalogEntry {
  key: string
  labelKey: string
}

export type ReportKpiFamily = 'axis' | 'fixed'

// The full set of independently-configurable KPI scopes — every route id PLUS the
// switch positions that used to be their own route (see the file-top comment).
// 'leads'/'prospects' are population filters on the candidates/customers table;
// the rest are switch positions on the customerstructure/people/usage routes.
export type ReportKpiScopeId = ReportId
  | 'leads' | 'prospects'
  | 'recruiters' | 'accountmanagers'
  | 'contacts' | 'locations' | 'departments'
  | 'ai' | 'workflows'

// Every configurable scope, in the order the settings screen lists them —
// mirrors the pre-consolidation REPORT_IDS order with 'leads'/'prospects' next
// to their host axis and the three merged pages' positions grouped together.
// 'sources' is deliberately absent (see the file-top comment).
export const REPORT_KPI_SCOPE_IDS: ReportKpiScopeId[] = [
  'candidates', 'leads',
  'applications',
  'customers', 'prospects',
  'contacts', 'locations', 'departments',
  'flow',
  'recruiters', 'accountmanagers',
  'vacancies', 'opportunities', 'tasks', 'matches', 'intakes', 'outreach',
  'ai', 'workflows',
]

// Reports with no configurable KPI strip at all (e.g. no ReportKpiBand, or a
// strip that isn't nine independent cards) are simply absent from these maps;
// the settings screen skips them.
export const REPORT_KPI_FAMILY: Partial<Record<ReportKpiScopeId, ReportKpiFamily>> = {
  candidates: 'axis',
  leads: 'axis',
  applications: 'axis',
  customers: 'axis',
  prospects: 'axis',
  flow: 'fixed',
  recruiters: 'fixed',
  accountmanagers: 'fixed',
  vacancies: 'fixed',
  opportunities: 'fixed',
  tasks: 'fixed',
  matches: 'fixed',
  intakes: 'fixed',
  outreach: 'fixed',
  contacts: 'fixed',
  locations: 'fixed',
  departments: 'fixed',
  ai: 'fixed',
  workflows: 'fixed',
}

// Axis-family catalogues: the report's own fixed axis list (today's hardcoded
// AxisKpiConfig ids), in the report's current default priority order. Card 1
// ("total") is pinned and not part of this list — see REPORT_KPI_PINNED_FIRST.
// 'leads' mirrors 'candidates' exactly and 'prospects' mirrors 'customers'
// exactly — same axes, same labels, same underlying report component; only the
// STORED ORDER (its own settings key) and the live data (server-side `phase`
// filter) differ per position.
export const REPORT_KPI_AXIS_CATALOG: Partial<Record<ReportKpiScopeId, KpiCatalogEntry[]>> = {
  candidates: [
    { key: 'status', labelKey: 'candidates.axes.status' },
    { key: 'phase', labelKey: 'candidates.axes.phase' },
    { key: 'source', labelKey: 'candidates.axes.source' },
    { key: 'owner', labelKey: 'candidates.axes.owner' },
    { key: 'branch', labelKey: 'candidates.axes.branch' },
  ],
  leads: [
    { key: 'status', labelKey: 'candidates.axes.status' },
    { key: 'phase', labelKey: 'candidates.axes.phase' },
    { key: 'source', labelKey: 'candidates.axes.source' },
    { key: 'owner', labelKey: 'candidates.axes.owner' },
    { key: 'branch', labelKey: 'candidates.axes.branch' },
  ],
  applications: [
    { key: 'stage', labelKey: 'applications.axes.stage' },
    { key: 'source', labelKey: 'applications.axes.source' },
    { key: 'owner', labelKey: 'applications.axes.owner' },
    { key: 'customer', labelKey: 'applications.axes.customer' },
  ],
  customers: [
    { key: 'status', labelKey: 'customers.axes.status' },
    { key: 'phase', labelKey: 'customers.axes.phase' },
    { key: 'industry', labelKey: 'customers.axes.industry' },
    { key: 'owner', labelKey: 'customers.axes.owner' },
    { key: 'branch', labelKey: 'customers.axes.branch' },
  ],
  prospects: [
    { key: 'status', labelKey: 'customers.axes.status' },
    { key: 'phase', labelKey: 'customers.axes.phase' },
    { key: 'industry', labelKey: 'customers.axes.industry' },
    { key: 'owner', labelKey: 'customers.axes.owner' },
    { key: 'branch', labelKey: 'customers.axes.branch' },
  ],
}

// Fixed-family catalogues — one entry per today's literal `kpis: KpiSpec[]` card,
// in the report's current order. This IS today's default order (see
// REPORT_KPI_DEFAULT_ORDER below): no spare cards exist yet (step 6 of the
// design's build order grows these per report, later, one at a time).
export const REPORT_KPI_FIXED_CATALOG: Partial<Record<ReportKpiScopeId, KpiCatalogEntry[]>> = {
  flow: [
    { key: 'total', labelKey: 'flow.total' },
    { key: 'firstPhase', labelKey: 'flow.firstPhase' },
    { key: 'lastPhase', labelKey: 'flow.lastPhase' },
    { key: 'conv', labelKey: 'flow.overallConversion' },
    { key: 'dropOff', labelKey: 'flow.dropOff' },
    { key: 'avgDaysOverall', labelKey: 'flow.avgDaysOverall' },
    { key: 'maxDropPhase', labelKey: 'flow.maxDropPhase' },
    { key: 'stagesReached', labelKey: 'flow.stagesReached' },
    { key: 'stagesTotal', labelKey: 'flow.stagesTotal' },
  ],
  recruiters: [
    { key: 'recruiters', labelKey: 'recruiters.summary.recruiters' },
    { key: 'candidates', labelKey: 'recruiters.summary.candidates' },
    { key: 'applications', labelKey: 'recruiters.summary.applications' },
    { key: 'matches', labelKey: 'recruiters.summary.matches' },
    { key: 'notContacted', labelKey: 'recruiters.summary.notContacted' },
    { key: 'intakesPlanned', labelKey: 'recruiters.summary.intakesPlanned' },
    { key: 'intakesDone', labelKey: 'recruiters.summary.intakesDone' },
    { key: 'tasksOpen', labelKey: 'recruiters.summary.tasksOpen' },
    { key: 'tasksOverdue', labelKey: 'recruiters.summary.tasksOverdue' },
  ],
  accountmanagers: [
    { key: 'accountManagers', labelKey: 'accountmanagers.summary.accountManagers' },
    { key: 'customers', labelKey: 'accountmanagers.summary.customersInWindow' },
    { key: 'avgPerManager', labelKey: 'accountmanagers.summary.avgPerManager' },
    { key: 'topManager', labelKey: 'accountmanagers.summary.topManager' },
    { key: 'openOpportunities', labelKey: 'accountmanagers.summary.openOpportunities' },
    { key: 'activeMatches', labelKey: 'accountmanagers.summary.activeMatches' },
    { key: 'revenue', labelKey: 'accountmanagers.summary.revenue' },
    { key: 'renewalsDue', labelKey: 'accountmanagers.summary.renewalsDue' },
    { key: 'notContacted', labelKey: 'accountmanagers.summary.notContacted' },
  ],
  vacancies: [
    { key: 'total', labelKey: 'vacancies.summary.total' },
    { key: 'open', labelKey: 'vacancies.summary.open' },
    { key: 'filled', labelKey: 'vacancies.summary.filled' },
    { key: 'fillRate', labelKey: 'vacancies.summary.fillRate' },
    { key: 'ttf', labelKey: 'vacancies.summary.avgTimeToFill' },
    { key: 'staleOnline', labelKey: 'vacancies.summary.staleOnline' },
    { key: 'customersCount', labelKey: 'vacancies.summary.customersCount' },
    { key: 'topIndustry', labelKey: 'vacancies.summary.topIndustry' },
    { key: 'topOwner', labelKey: 'vacancies.summary.topOwner' },
  ],
  opportunities: [
    { key: 'total', labelKey: 'opportunities.total' },
    { key: 'open', labelKey: 'opportunities.summary.open' },
    { key: 'won', labelKey: 'opportunities.summary.won' },
    { key: 'lost', labelKey: 'opportunities.summary.lost' },
    { key: 'winRate', labelKey: 'opportunities.summary.winRate' },
    { key: 'untouched', labelKey: 'opportunities.stale.untouched' },
    { key: 'overdue', labelKey: 'opportunities.stale.overdue' },
    { key: 'forecastCount', labelKey: 'opportunities.forecastCount' },
    { key: 'forecastValue', labelKey: 'opportunities.forecastValue' },
  ],
  tasks: [
    { key: 'total', labelKey: 'tasks.total' },
    { key: 'open', labelKey: 'tasks.summary.open' },
    { key: 'done', labelKey: 'tasks.summary.done' },
    { key: 'overdue', labelKey: 'tasks.summary.overdue' },
    { key: 'doneRate', labelKey: 'tasks.summary.doneRate' },
    { key: 'unassigned', labelKey: 'tasks.unassigned' },
    { key: 'noTeam', labelKey: 'tasks.noTeam' },
    { key: 'noBranch', labelKey: 'tasks.noBranch' },
    { key: 'overdueRate', labelKey: 'tasks.overdueRate' },
  ],
  matches: [
    { key: 'total', labelKey: 'matches.total' },
    { key: 'funnel', labelKey: 'matches.viaFunnel' },
    { key: 'direct', labelKey: 'matches.direct' },
    { key: 'sent', labelKey: 'matches.placements.sent' },
    { key: 'active', labelKey: 'matches.placements.active' },
    { key: 'ended', labelKey: 'matches.placements.ended' },
    { key: 'terminationsTotal', labelKey: 'matches.terminations.total' },
    { key: 'dur', labelKey: 'matches.avgDuration' },
    { key: 'terminationRate', labelKey: 'matches.terminations.rate' },
  ],
  intakes: [
    { key: 'total', labelKey: 'intakes.total' },
    { key: 'recruitersCount', labelKey: 'intakes.summary.recruitersCount' },
    { key: 'locationsCount', labelKey: 'intakes.summary.locationsCount' },
    { key: 'sourcesCount', labelKey: 'intakes.summary.sourcesCount' },
    { key: 'functionsCount', labelKey: 'intakes.summary.functionsCount' },
    { key: 'regionsCount', labelKey: 'intakes.summary.regionsCount' },
    { key: 'topRecruiter', labelKey: 'intakes.summary.topRecruiter' },
    { key: 'topSource', labelKey: 'intakes.summary.topSource' },
    { key: 'topFunction', labelKey: 'intakes.summary.topFunction' },
  ],
  outreach: [
    { key: 'total', labelKey: 'outreach.total' },
    { key: 'reached', labelKey: 'outreach.reached' },
    { key: 'rate', labelKey: 'outreach.reachRate' },
    { key: 'notReached', labelKey: 'outreach.summary.notReached' },
    { key: 'assigned', labelKey: 'outreach.summary.assigned' },
    { key: 'unassigned', labelKey: 'outreach.summary.unassigned' },
    { key: 'noOutcome', labelKey: 'outreach.summary.noOutcome' },
    { key: 'topCampaign', labelKey: 'outreach.summary.topCampaign' },
    { key: 'topChannel', labelKey: 'outreach.summary.topChannel' },
  ],
  contacts: [
    { key: 'total', labelKey: 'contacts.total' },
    { key: 'primary', labelKey: 'contacts.summary.primary' },
    { key: 'withRecentContact', labelKey: 'contacts.summary.withRecentContact' },
    { key: 'neverContacted', labelKey: 'contacts.summary.neverContacted' },
    { key: 'contactedRate', labelKey: 'contacts.summary.contactedRate' },
    { key: 'withoutFunction', labelKey: 'contacts.summary.withoutFunction' },
    { key: 'withoutLocation', labelKey: 'contacts.summary.withoutLocation' },
    { key: 'withoutDepartment', labelKey: 'contacts.summary.withoutDepartment' },
    { key: 'withoutCustomer', labelKey: 'contacts.summary.withoutCustomer' },
  ],
  locations: [
    { key: 'total', labelKey: 'locations.total' },
    { key: 'withCustomer', labelKey: 'locations.summary.withCustomer' },
    { key: 'withoutCustomer', labelKey: 'locations.summary.withoutCustomer' },
    { key: 'withoutCity', labelKey: 'locations.summary.withoutCity' },
    { key: 'topCity', labelKey: 'locations.summary.topCity' },
    { key: 'withoutProvince', labelKey: 'locations.summary.withoutProvince' },
    { key: 'topProvince', labelKey: 'locations.summary.topProvince' },
    { key: 'withDepartments', labelKey: 'locations.summary.withDepartments' },
    { key: 'withoutDepartments', labelKey: 'locations.summary.withoutDepartments' },
  ],
  departments: [
    { key: 'total', labelKey: 'departments.total' },
    { key: 'withLocation', labelKey: 'departments.summary.withLocation' },
    { key: 'withoutLocation', labelKey: 'departments.summary.withoutLocation' },
    { key: 'withoutCustomer', labelKey: 'departments.summary.withoutCustomer' },
    { key: 'topCustomer', labelKey: 'departments.summary.topCustomer' },
    { key: 'topLocation', labelKey: 'departments.summary.topLocation' },
    { key: 'customersCount', labelKey: 'departments.summary.customersCount' },
    { key: 'withContacts', labelKey: 'departments.summary.withContacts' },
    { key: 'withoutContacts', labelKey: 'departments.summary.withoutContacts' },
  ],
  ai: [
    { key: 'total', labelKey: 'ai.total' },
    { key: 'tokens', labelKey: 'ai.summary.tokens' },
    { key: 'amount', labelKey: 'ai.summary.amount' },
    { key: 'avgTokens', labelKey: 'ai.summary.avgTokens' },
    { key: 'avgAmount', labelKey: 'ai.summary.avgAmount' },
    { key: 'activityTypes', labelKey: 'ai.summary.activityTypes' },
    { key: 'modelsUsed', labelKey: 'ai.summary.modelsUsed' },
    { key: 'activeUsers', labelKey: 'ai.summary.activeUsers' },
    { key: 'topActivity', labelKey: 'ai.summary.topActivity' },
  ],
  workflows: [
    { key: 'runs', labelKey: 'workflows.summary.runs' },
    { key: 'completed', labelKey: 'workflows.summary.completed' },
    { key: 'failed', labelKey: 'workflows.summary.failed' },
    { key: 'cancelled', labelKey: 'workflows.summary.cancelled' },
    { key: 'running', labelKey: 'workflows.summary.running' },
    { key: 'successRate', labelKey: 'workflows.summary.successRate' },
    { key: 'avgDuration', labelKey: 'workflows.summary.avgDuration' },
    { key: 'workflowsCount', labelKey: 'workflows.summary.workflowsCount' },
    { key: 'triggersCount', labelKey: 'workflows.summary.triggersCount' },
  ],
}

// Card 1 pinned = not offered in the catalogue/editor for that report. True for
// the five axis-family scopes (their "total" is a special inline card, not part
// of any axis) — proposal from the design doc, technically the simpler path.
export const REPORT_KPI_PINNED_FIRST: Partial<Record<ReportKpiScopeId, string>> = {
  candidates: 'total',
  leads: 'total',
  applications: 'total',
  customers: 'total',
  prospects: 'total',
}

// The scope's catalogue, regardless of family — what the editor's picker offers.
export function getReportKpiCatalog(scopeId: ReportKpiScopeId): KpiCatalogEntry[] {
  const family = REPORT_KPI_FAMILY[scopeId]
  if (family === 'axis') return REPORT_KPI_AXIS_CATALOG[scopeId] ?? []
  if (family === 'fixed') return REPORT_KPI_FIXED_CATALOG[scopeId] ?? []
  return []
}

// Today's default order — identical to what the report renders when nothing is
// stored. For 'fixed' scopes this equals the catalogue itself 1:1 (see module
// doc comment): no spare cards exist yet, only reordering is meaningfully new.
export function getReportKpiDefaultOrder(scopeId: ReportKpiScopeId): string[] {
  return getReportKpiCatalog(scopeId).map(e => e.key)
}

// True once a scope's catalogue holds more entries than its default order needs
// (i.e. real spare cards to swap in) — used by the settings screen to decide
// between a real "swap" picker and an honest "reorder only, no alternatives yet" notice.
export function reportHasSpareKpiCards(scopeId: ReportKpiScopeId): boolean {
  return getReportKpiCatalog(scopeId).length > getReportKpiDefaultOrder(scopeId).length
}

// The tenant-facing settings key for a scope's stored KPI order. Stable across
// the RAPPORTEN-CONSOLIDATIE-1 route merge (see file-top comment) — a scope id
// never changes even when its ROUTE does, so an existing tenant customisation
// under e.g. `report_kpis_recruiters` keeps resolving unchanged.
export function reportKpiSettingsKey(scopeId: ReportKpiScopeId): string {
  return `report_kpis_${scopeId}`
}
