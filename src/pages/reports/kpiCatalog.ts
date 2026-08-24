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
export type ReportKpiScopeId = ReportId | 'leads' | 'prospects'

// Every configurable scope, in the order the settings screen lists them —
// mirrors the pre-consolidation REPORT_IDS order with 'leads'/'prospects' next
// to their host axis and the three merged pages' positions grouped together.
// 'sources' is deliberately absent (see the file-top comment).
// RAPPORTEN-DANNY10-1: only the surviving reports (Danny's ten-page design)
// are configurable scopes; the retired scopes and their catalog blocks were
// removed with their pages in the explicit cleanup round.
export const REPORT_KPI_SCOPE_IDS: ReportKpiScopeId[] = [
  'candidates', 'leads',
  'applications',
  'customers', 'prospects',
  'vacancies', 'opportunities', 'tasks', 'matches', 'outreach', 'whatsapp',
]

// Reports with no configurable KPI strip at all (e.g. no ReportKpiBand, or a
// strip that isn't nine independent cards) are simply absent from these maps;
// the settings screen skips them.
export const REPORT_KPI_FAMILY: Partial<Record<ReportKpiScopeId, ReportKpiFamily>> = {
  candidates: 'axis',
  leads: 'axis',
  customers: 'axis',
  prospects: 'axis',
  // RAPPORT-APPS-VERDIEPING-1: 'applications' moved from 'axis' to 'fixed' —
  // the strip is now the server's own nine-card kpis[] (see REPORT_KPI_FIXED_CATALOG).
  applications: 'fixed',
  vacancies: 'fixed',
  opportunities: 'fixed',
  tasks: 'fixed',
  matches: 'fixed',
  outreach: 'fixed',
  whatsapp: 'fixed',
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
  // RAPPORT-APPS-VERDIEPING-1 (CMFE 24-08): the nine backend cards now ride in
  // the /reports/applications ENVELOPE's own `kpis[]` (one-envelope migration —
  // the sibling /reports/applications/kpis endpoint stays alive during the
  // migration window). Same nine-key vocabulary the drill's
  // ApplicationsKpiDrillRequest enum pins (measured in api-generated.ts):
  // total/new/active/matched/rejected/conversion_pct/avg_days_to_match/
  // too_long_in_stage/missing_appointment. `applications` moved here from the
  // axis catalogue (was 'axis' family) since the strip is now the server's
  // fixed nine, mirroring whatsapp's pattern exactly — the axis BAR SECTIONS
  // below the strip (stage/source/owner/customer/vacancy/stage_duration/bucket)
  // are unaffected, they still drill through /reports/applications/drill.
  applications: [
    { key: 'total', labelKey: 'applications.kpi.total' },
    { key: 'new', labelKey: 'applications.kpi.new' },
    { key: 'active', labelKey: 'applications.kpi.active' },
    { key: 'matched', labelKey: 'applications.kpi.matched' },
    { key: 'rejected', labelKey: 'applications.kpi.rejected' },
    { key: 'conversionPct', labelKey: 'applications.kpi.conversionPct' },
    { key: 'avgDaysToMatch', labelKey: 'applications.kpi.avgDaysToMatch' },
    { key: 'tooLongInStage', labelKey: 'applications.kpi.tooLongInStage' },
    { key: 'missingAppointment', labelKey: 'applications.kpi.missingAppointment' },
  ],
  whatsapp: [
    { key: 'conversationsTotal', labelKey: 'whatsapp.kpi.conversationsTotal' },
    { key: 'active7d', labelKey: 'whatsapp.kpi.active7d' },
    { key: 'newInPeriod', labelKey: 'whatsapp.kpi.newInPeriod' },
    { key: 'inboundInPeriod', labelKey: 'whatsapp.kpi.inboundInPeriod' },
    { key: 'outboundInPeriod', labelKey: 'whatsapp.kpi.outboundInPeriod' },
    { key: 'appEchoesInPeriod', labelKey: 'whatsapp.kpi.appEchoesInPeriod' },
    { key: 'escalationsOpen', labelKey: 'whatsapp.kpi.escalationsOpen' },
    { key: 'unansweredOverWindow', labelKey: 'whatsapp.kpi.unansweredOverWindow' },
    { key: 'avgFirstResponseMinutes', labelKey: 'whatsapp.kpi.avgFirstResponseMinutes' },
  ],
}

// Card 1 pinned = not offered in the catalogue/editor for that report. True for
// the five axis-family scopes (their "total" is a special inline card, not part
// of any axis) — proposal from the design doc, technically the simpler path.
export const REPORT_KPI_PINNED_FIRST: Partial<Record<ReportKpiScopeId, string>> = {
  candidates: 'total',
  leads: 'total',
  customers: 'total',
  prospects: 'total',
  // 'applications' no longer pins 'total' outside the catalogue — it is now a
  // fixed-family scope and 'total' is just kpis[0], reorderable like whatsapp's.
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
