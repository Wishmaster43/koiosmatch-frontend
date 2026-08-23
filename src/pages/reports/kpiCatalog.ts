/**
 * kpiCatalog — the data-independent manifest behind the "which nine KPI cards"
 * settings screen (RAPPORT-KPI-INSTELBAAR). Two families exist, mirrored from how
 * each report already builds its strip (never a second hand-maintained list):
 *
 * - `family: 'axis'` (candidates, leads, applications, customers, prospects) — cards
 *   2-9 are derived live per-tenant by `buildAxisKpis` from the report's own axis
 *   segments (the SPECIFIC top segment is data-dependent, so it can't be a stable
 *   catalogue entry). What IS stable and pickable is the axis itself — its id and
 *   order. Card 1 ("total") stays pinned; it is not part of the catalogue. `customers`
 *   (REPORTS-KPI-SPARE-2) additionally offers nine single-segment "signal" pseudo-axes
 *   built from the report's own `kpis[]` array (real standing counts the strip never
 *   surfaced) — see REPORT_KPI_AXIS_DEFAULT_LENGTH below for why its default order
 *   stays capped at five, not nine. `prospects` deliberately does NOT mirror those
 *   signal spares — they describe an existing client relationship a lead can't have.
 *   `candidates`/`leads`/`applications` (REPORTS-KPI-SPARE-3) also grew real
 *   spares this way — single-segment 'none'-bucket pseudo-axes plus (applications
 *   only) two full axes the strip already computes but never offered (vacancy,
 *   stage duration) — see REPORT_KPI_AXIS_DEFAULT_LENGTH.
 * - `family: 'fixed'` — every other report's nine cards are a literal, hand-written
 *   array today. The catalogue entry IS that literal card (key + i18n label ref),
 *   copied here without touching the report's own compute logic. Most scopes still
 *   equal the report's current default order 1:1 (no spares yet); `vacancies`,
 *   `opportunities`, `tasks`, `matches`, `intakes`, `outreach`, `ai`, `workflows`
 *   (REPORTS-KPI-SPARE-1) and `recruiters`, `accountmanagers`, `contacts`, `locations`,
 *   `departments` (REPORTS-KPI-SPARE-2) each grew spare entries beyond their nine
 *   defaults — real fields the endpoint already returns but the strip never surfaced
 *   (a summary counter, an honest ratio of two real counts, or the biggest real
 *   segment of an axis the report already renders). `hasSpareCards` reports per-scope
 *   so the settings screen can be honest where a picker would still have nothing to offer.
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

// The nine backend `kpis[].key` STANDING-signal slugs (CustomersReport::KPI_KEYS)
// mapped to their `customers.kpis.*` i18n suffix — the ONE place this mapping is
// spelled out, consumed both by the catalog entries below (labelKey) and by
// CustomersReport.tsx (to build each pseudo-axis's axisLabel) so the two can
// never silently drift into two different label sets for the same signal.
export const CUSTOMERS_SIGNAL_LABEL_KEYS: Record<string, string> = {
  contract_ending: 'contractEnding',
  no_contact: 'noContact',
  task_overdue: 'taskOverdue',
  price_agreement_ending: 'priceAgreementEnding',
  vacancy_stale: 'vacancyStale',
  departments_without_placement: 'departmentsWithoutPlacement',
  customers_without_vacancies: 'customersWithoutVacancies',
  customers_without_applications: 'customersWithoutApplications',
  matches_stopped_early: 'matchesStoppedEarly',
}

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
  'usage', 'ai', 'workflows',
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
  usage: 'fixed',
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
  // 'candidates'/'leads' spares (REPORTS-KPI-SPARE-3): single-segment pseudo-axes
  // built from the report's own by_owner/by_branch/by_source distributions
  // (GET /reports/candidates already returns their real 'none' sentinel rows —
  // CandidatesReport::ownerDistribution/branchDistribution/sourceDistribution —
  // the strip just never surfaced them on their own). `phase_lead` reuses the
  // SAME flag-derived lead-phase value the Kandidaten/Leads switch itself resolves
  // (CandidatesReport.tsx's `leadPhaseValue`, never a hardcoded slug) so "still a
  // Lead" is only offered on the Kandidaten position — on Leads every row already
  // IS that phase, making the card always ≈ total and not worth offering there.
  candidates: [
    { key: 'status', labelKey: 'candidates.axes.status' },
    { key: 'phase', labelKey: 'candidates.axes.phase' },
    { key: 'source', labelKey: 'candidates.axes.source' },
    { key: 'owner', labelKey: 'candidates.axes.owner' },
    { key: 'branch', labelKey: 'candidates.axes.branch' },
    { key: 'owner_none', labelKey: 'candidates.axes.ownerNone' },
    { key: 'branch_none', labelKey: 'candidates.axes.branchNone' },
    { key: 'source_none', labelKey: 'candidates.axes.sourceNone' },
    { key: 'phase_lead', labelKey: 'candidates.axes.phaseLead' },
  ],
  leads: [
    { key: 'status', labelKey: 'candidates.axes.status' },
    { key: 'phase', labelKey: 'candidates.axes.phase' },
    { key: 'source', labelKey: 'candidates.axes.source' },
    { key: 'owner', labelKey: 'candidates.axes.owner' },
    { key: 'branch', labelKey: 'candidates.axes.branch' },
    { key: 'owner_none', labelKey: 'candidates.axes.ownerNone' },
    { key: 'branch_none', labelKey: 'candidates.axes.branchNone' },
    { key: 'source_none', labelKey: 'candidates.axes.sourceNone' },
  ],
  // 'applications' spares (REPORTS-KPI-SPARE-3): `vacancy`/`stageDuration` are
  // real full axes GET /reports/applications already returns (by_vacancy,
  // by_stage_duration) but the strip never offered as swap-in options (the
  // component's own doc note: "vacancy stays out of the strip" — now a CHOICE,
  // not a hard exclusion). `customer_none`/`stage_none` are single-segment
  // pseudo-axes over the report's own real 'none' sentinel rows
  // (ApplicationsReport::CUSTOMER_NONE/STAGE_NONE).
  applications: [
    { key: 'stage', labelKey: 'applications.axes.stage' },
    { key: 'source', labelKey: 'applications.axes.source' },
    { key: 'owner', labelKey: 'applications.axes.owner' },
    { key: 'customer', labelKey: 'applications.axes.customer' },
    { key: 'vacancy', labelKey: 'applications.axes.vacancy' },
    { key: 'stage_duration', labelKey: 'applications.axes.stageDuration' },
    { key: 'customer_none', labelKey: 'applications.axes.customerNone' },
    { key: 'stage_none', labelKey: 'applications.axes.stageNone' },
  ],
  // 'customers' spares (KPI-SPARE-1): nine pseudo-axes built from the report's own
  // `kpis[]` STANDING-signal array (GET /reports/customers, CustomersReport::signalKpis) —
  // real, already-computed counts (contract ending, no contact, overdue tasks, …) that
  // sat in the response entirely unused by the strip. Each renders as a single-segment
  // "axis" (buildAxisKpis round-robins it in as one card, never split further) — see
  // CustomersReport.tsx's `signalAxisConfigs`. Deliberately NOT offered on 'prospects'
  // (below): every one of these signals describes an existing client relationship
  // (contract, price agreement, placement coverage) that a lead/prospect cannot yet
  // have — offering them there would be a pickable card that always reads zero/absent.
  customers: [
    { key: 'status', labelKey: 'customers.axes.status' },
    { key: 'phase', labelKey: 'customers.axes.phase' },
    { key: 'industry', labelKey: 'customers.axes.industry' },
    { key: 'owner', labelKey: 'customers.axes.owner' },
    { key: 'branch', labelKey: 'customers.axes.branch' },
    ...Object.entries(CUSTOMERS_SIGNAL_LABEL_KEYS).map(([signalKey, i18nSuffix]) => ({
      key: `signal:${signalKey}`, labelKey: `customers.kpis.${i18nSuffix}`,
    })),
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
// in the report's current order, PLUS (per REPORTS-KPI-SPARES-1) any extra spare
// cards appended after those first nine. The first nine entries of each array are
// always the report's current default order (see getReportKpiDefaultOrder below,
// which slices to that fixed length) — a spare is only ever appended, never
// inserted before position nine, so the default strip never silently changes.
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
    // Spares (REPORTS-KPI-SPARE-3): honest derivations over the report's own
    // `phases[]` array (GET /reports/flow) — a per-phase conversion/avg-days
    // extremum (mirrors maxDropPhase's "biggest real value" pattern, a
    // different axis than the absolute-drop one), a rate over the two counts
    // `dropOff` already derives from, and the honest complement of
    // `stagesReached`/`stagesTotal`. No new backend field.
    { key: 'worstConversionPhase', labelKey: 'flow.worstConversionPhase' },
    { key: 'slowestPhase', labelKey: 'flow.slowestPhase' },
    { key: 'dropOffRate', labelKey: 'flow.dropOffRate' },
    { key: 'stagesEmpty', labelKey: 'flow.stagesEmpty' },
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
    // Spares (REPORTS-KPI-SPARE-1): honest derivations over the report's own
    // per-recruiter rows (RecruitersReport::run) — average book size, the
    // recruiter with the biggest book (mirrors accountmanagers.topManager), and
    // two rates over counts already summed for the strip. No new backend field.
    { key: 'avgCandidatesPerRecruiter', labelKey: 'recruiters.summary.avgCandidatesPerRecruiter' },
    { key: 'topRecruiter', labelKey: 'recruiters.summary.topRecruiter' },
    { key: 'intakeCompletionRate', labelKey: 'recruiters.summary.intakeCompletionRate' },
    { key: 'taskOverdueRate', labelKey: 'recruiters.summary.taskOverdueRate' },
  ],
  // REPORTS-ACCTMGR-1 follow-up: all nine now real (GET /reports/accountmanagers),
  // replacing the three placeholder dashes the customers-report-reuse stand-in
  // never could back (openOpportunities/activeMatches/revenue) with the report's
  // own real fields — never a permanent hardcoded dash once the data exists (§0).
  accountmanagers: [
    { key: 'accountManagers', labelKey: 'accountmanagers.summary.accountManagers' },
    { key: 'customers', labelKey: 'accountmanagers.summary.customersInWindow' },
    { key: 'avgPerManager', labelKey: 'accountmanagers.summary.avgPerManager' },
    { key: 'topManager', labelKey: 'accountmanagers.summary.topManager' },
    { key: 'openVacancies', labelKey: 'accountmanagers.summary.openVacancies' },
    { key: 'filledPositions', labelKey: 'accountmanagers.summary.filledPositions' },
    { key: 'opportunities', labelKey: 'accountmanagers.summary.opportunities' },
    { key: 'renewalsDue', labelKey: 'accountmanagers.summary.renewalsDue' },
    { key: 'notContacted', labelKey: 'accountmanagers.summary.notContacted' },
    // Spares (REPORTS-KPI-SPARE-1): honest derivations over the report's own
    // per-manager rows (AccountManagersReport::run) — two "per manager" averages
    // (mirrors avgPerManager) and two rates over counts already in the strip.
    { key: 'avgOpportunitiesPerManager', labelKey: 'accountmanagers.summary.avgOpportunitiesPerManager' },
    { key: 'avgVacanciesPerManager', labelKey: 'accountmanagers.summary.avgVacanciesPerManager' },
    { key: 'notContactedRate', labelKey: 'accountmanagers.summary.notContactedRate' },
    { key: 'renewalsDueRate', labelKey: 'accountmanagers.summary.renewalsDueRate' },
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
    // Spares (REPORTS-KPI-SPARE-1): real, so-far-unused fields already in the
    // GET /reports/vacancies envelope — summary.long_concept / summary.no_matches
    // (VacanciesReport::applySignal, same family as staleOnline) and the top
    // real segment of the function/branch axes (mirrors topIndustry/topOwner).
    { key: 'longConcept', labelKey: 'vacancies.summary.longConcept' },
    { key: 'noMatches', labelKey: 'vacancies.summary.noMatches' },
    { key: 'topFunction', labelKey: 'vacancies.summary.topFunction' },
    { key: 'topBranch', labelKey: 'vacancies.summary.topBranch' },
    // KPI-DREMPELS-FE-1: summary.advice_stale / summary.closing_soon, each with its
    // own tenant day-threshold caption. adviceStale mirrors staleOnline's predicate;
    // closingSoon drills via its own `closing_soon` boolean XOR key (VAC-CLOSING-
    // SOON-DRILL-1, mirrors stale_online — never a `signal` param).
    { key: 'adviceStale', labelKey: 'vacancies.summary.adviceStale' },
    { key: 'closingSoon', labelKey: 'vacancies.summary.closingSoon' },
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
    // Spares (REPORTS-KPI-SPARE-1): real fields already in the envelope —
    // totals.open_value/won_value (money, same source as forecastValue) and the
    // top real segment of by_stage/by_customer (mirrors the vacancies top-* cards).
    { key: 'openValue', labelKey: 'opportunities.summary.openValue' },
    { key: 'wonValue', labelKey: 'opportunities.summary.wonValue' },
    { key: 'topStage', labelKey: 'opportunities.summary.topStage' },
    { key: 'topCustomer', labelKey: 'opportunities.summary.topCustomer' },
    // KPI-DREMPELS-FE-1: totals.stale / totals.closing_soon (additive, distinct
    // from the older top-level `stale` object above), each with its own tenant
    // day-threshold caption — not drillable (no XOR param), same non-clickable
    // pattern the pipeline five above already use.
    { key: 'staleDeal', labelKey: 'opportunities.summary.staleDeal' },
    { key: 'closingSoon', labelKey: 'opportunities.summary.closingSoon' },
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
    // Spares (REPORTS-KPI-SPARE-1): the top real segment of each existing axis
    // (by_status/by_type/by_priority/by_assignee), same "biggest real value"
    // pattern as vacancies' topIndustry/topOwner — no new backend field needed.
    { key: 'topStatus', labelKey: 'tasks.summary.topStatus' },
    { key: 'topType', labelKey: 'tasks.summary.topType' },
    { key: 'topPriority', labelKey: 'tasks.summary.topPriority' },
    { key: 'topAssignee', labelKey: 'tasks.summary.topAssignee' },
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
    // Spares (REPORTS-KPI-SPARE-1): the fourth under_contract tile (`none`,
    // already in the envelope but never offered as its own card), the top real
    // segment of by_contract_form / terminations.by_reason, and an honest ratio
    // of two real counts (funnel share of total).
    { key: 'noContract', labelKey: 'matches.summary.noContract' },
    { key: 'topContractForm', labelKey: 'matches.summary.topContractForm' },
    { key: 'topTerminationReason', labelKey: 'matches.terminations.topReason' },
    { key: 'funnelRate', labelKey: 'matches.summary.funnelRate' },
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
    // Spares (REPORTS-KPI-SPARES-1) — all four read off fields the endpoint
    // already returns (by_recruiter/by_location/by_region/total), no new field.
    { key: 'unassignedRecruiter', labelKey: 'intakes.summary.unassignedRecruiter' },
    { key: 'topLocation', labelKey: 'intakes.summary.topLocation' },
    { key: 'topRegion', labelKey: 'intakes.summary.topRegion' },
    { key: 'avgPerRecruiter', labelKey: 'intakes.summary.avgPerRecruiter' },
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
    // Spares (REPORTS-KPI-SPARES-1) — all five read off by_status/by_outcome/
    // by_campaign/by_channel/by_assignee, already in the response.
    { key: 'topStatus', labelKey: 'outreach.summary.topStatus' },
    { key: 'topOutcome', labelKey: 'outreach.summary.topOutcome' },
    { key: 'campaignsCount', labelKey: 'outreach.summary.campaignsCount' },
    { key: 'channelsUsed', labelKey: 'outreach.summary.channelsUsed' },
    { key: 'assigneesCount', labelKey: 'outreach.summary.assigneesCount' },
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
    // Spares (REPORTS-KPI-SPARE-1): the top real ('none'-excluded) segment of
    // each existing axis — mirrors the topCity/topProvince pattern already used
    // by LocationsReport/DepartmentsReport. No new backend field.
    { key: 'topCustomer', labelKey: 'contacts.summary.topCustomer' },
    { key: 'topFunction', labelKey: 'contacts.summary.topFunction' },
    { key: 'topLocation', labelKey: 'contacts.summary.topLocation' },
    { key: 'topDepartment', labelKey: 'contacts.summary.topDepartment' },
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
    // Spares (REPORTS-KPI-SPARE-1): `summary.with_contacts`/`without_contacts`
    // are real fields GET /reports/locations already returns (LocationsReport::
    // summary()) but the strip never surfaced — plus two honest coverage ratios
    // over counts already in the strip.
    { key: 'withContacts', labelKey: 'locations.summary.withContacts' },
    { key: 'withoutContacts', labelKey: 'locations.summary.withoutContacts' },
    { key: 'departmentCoverageRate', labelKey: 'locations.summary.departmentCoverageRate' },
    { key: 'contactCoverageRate', labelKey: 'locations.summary.contactCoverageRate' },
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
    // Spares (REPORTS-KPI-SPARE-1): `withCustomer` is the honest complement of
    // the existing `withoutCustomer` card (never shown on its own); the two
    // rates are honest ratios over counts already in the strip; `othersCustomer`
    // is the by_customer axis's own real 'others' rollup bucket (top-20 + rest).
    { key: 'withCustomer', labelKey: 'departments.summary.withCustomer' },
    { key: 'locationCoverageRate', labelKey: 'departments.summary.locationCoverageRate' },
    { key: 'contactCoverageRate', labelKey: 'departments.summary.contactCoverageRate' },
    { key: 'othersCustomer', labelKey: 'departments.summary.othersCustomer' },
  ],
  // The merged Verbruik overview. Every entry is read off (or derived from) the
  // single GET /reports/usage envelope — no card here needs a number the reader
  // cannot also see on the page itself.
  usage: [
    { key: 'total', labelKey: 'usage.summary.total' },
    { key: 'workflowCredits', labelKey: 'usage.summary.workflowCredits' },
    { key: 'aiCredits', labelKey: 'usage.summary.aiCredits' },
    { key: 'aiAmount', labelKey: 'usage.summary.aiAmount' },
    { key: 'modules', labelKey: 'usage.summary.modules' },
    { key: 'topModule', labelKey: 'usage.summary.topModule' },
    { key: 'busiestDay', labelKey: 'usage.summary.busiestDay' },
    { key: 'activeDays', labelKey: 'usage.summary.activeDays' },
    { key: 'avgPerDay', labelKey: 'usage.summary.avgPerDay' },
    // Spares (REPORTS-KPI-SPARES-1) — three shares over figures already on the
    // page plus the amount per consuming day; all ratios of two visible numbers.
    { key: 'aiShare', labelKey: 'usage.summary.aiShare' },
    { key: 'workflowShare', labelKey: 'usage.summary.workflowShare' },
    { key: 'topModuleShare', labelKey: 'usage.summary.topModuleShare' },
    { key: 'amountPerDay', labelKey: 'usage.summary.amountPerDay' },
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
    // Spares (REPORTS-KPI-SPARES-1) — all four read off by_model/by_user/total,
    // already in the GET /reports/ai envelope; no cost/margin figure is ever added.
    { key: 'topModel', labelKey: 'ai.summary.topModel' },
    { key: 'topUser', labelKey: 'ai.summary.topUser' },
    { key: 'avgPerUser', labelKey: 'ai.summary.avgPerUser' },
    { key: 'avgPerActivityType', labelKey: 'ai.summary.avgPerActivityType' },
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
    // Spares (REPORTS-KPI-SPARES-1) — all four read off by_workflow/by_trigger/
    // summary.runs/summary.failed, already in the GET /reports/workflows envelope.
    { key: 'topWorkflow', labelKey: 'workflows.summary.topWorkflow' },
    { key: 'topTrigger', labelKey: 'workflows.summary.topTrigger' },
    { key: 'failureRate', labelKey: 'workflows.summary.failureRate' },
    { key: 'avgRunsPerWorkflow', labelKey: 'workflows.summary.avgRunsPerWorkflow' },
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

// The fixed strip length every report renders (§0 EXACTLY NINE) — the default
// order is always this many keys, even once a catalogue grows spares beyond it.
const REPORT_KPI_DEFAULT_LENGTH = 9

// Axis-family scopes whose catalogue now holds real single-segment "signal"
// spares (KPI-SPARE-1) alongside their handful of true multi-segment axes —
// the slice-to-nine trick below only fits fixed-family scopes whose base strip
// is nine literal cards; an axis scope's own default is "every real axis it
// had before spares existed", which is almost always fewer than nine. Every
// axis scope absent here (prospects — untouched by this pass) keeps using its
// FULL catalogue length as before.
const REPORT_KPI_AXIS_DEFAULT_LENGTH: Partial<Record<ReportKpiScopeId, number>> = {
  customers: 5,
  candidates: 5,
  leads: 5,
  applications: 4,
}

// Today's default order — identical to what the report renders when nothing is
// stored. For 'fixed' scopes this is always the catalogue's FIRST nine entries:
// a scope's spare cards (REPORTS-KPI-SPARES-1) are appended after the default
// nine, never inserted before them, so growing the catalogue never changes what
// a never-configured tenant sees. For 'axis' scopes it is the catalogue's first
// N entries, N = REPORT_KPI_AXIS_DEFAULT_LENGTH[scope] when set (a scope whose
// spares grew its catalogue past its real axis count), else the whole list
// (buildAxisKpis pads the rest by round-robining each axis's own segments).
export function getReportKpiDefaultOrder(scopeId: ReportKpiScopeId): string[] {
  const family = REPORT_KPI_FAMILY[scopeId]
  const cap = family === 'axis' ? (REPORT_KPI_AXIS_DEFAULT_LENGTH[scopeId] ?? Infinity) : REPORT_KPI_DEFAULT_LENGTH
  return getReportKpiCatalog(scopeId).slice(0, cap).map(e => e.key)
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
