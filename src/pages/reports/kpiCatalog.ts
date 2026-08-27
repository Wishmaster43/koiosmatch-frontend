/**
 * kpiCatalog — the data-independent manifest behind the "which nine KPI cards"
 * settings screen (RAPPORT-KPI-INSTELBAAR). Two families exist, mirrored from how
 * each report already builds its strip (never a second hand-maintained list):
 *
 * - `family: 'axis'` (leads, prospects) — cards 2-9 are derived live per-tenant by
 *   `buildAxisKpis` from the report's own axis segments (the SPECIFIC top segment
 *   is data-dependent, so it can't be a stable catalogue entry). What IS stable
 *   and pickable is the axis itself — its id and order. Card 1 ("total") stays
 *   pinned; it is not part of the catalogue. `candidates`/`leads`/`applications`
 *   (REPORTS-KPI-SPARE-3) also grew real
 *   spares this way — single-segment 'none'-bucket pseudo-axes plus (applications
 *   only) two full axes the strip already computes but never offered (vacancy,
 *   stage duration) — see REPORT_KPI_AXIS_DEFAULT_LENGTH.
 * - `family: 'fixed'` — every other report's nine cards are a literal, hand-written
 *   array today. The catalogue entry IS that literal card (key + i18n label ref),
 *   copied here without touching the report's own compute logic. `customers`
 *   (KPI-CUSTOMERS-SIGNALS-1) moved here from the axis family — its nine cards are
 *   now the report's own STANDING signal `kpis[]` suite (CUSTOMERS_SIGNAL_LABEL_KEYS
 *   below), replacing the old axis-topsegment filler cards; `prospects` still has
 *   no signal suite (those describe an existing client relationship a lead can't
 *   have) so it stays on the axis family, untouched. Since the 28-08 server-suite
 *   flips (matches, customers, opportunities, vacancies — each catalog now exactly
 *   its server nine) only `leads` still carries spare entries beyond its defaults;
 *   every other scope equals its default order 1:1. `hasSpareCards` reports
 *   per-scope so the settings screen stays honest where a picker has nothing extra
 *   to offer.
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
  // RAPPORT-GEZICHT-WAVE2: 'candidates' moved from 'axis' to 'fixed' — the strip
  // is now the server's own nine-card suite (GET /reports/candidates/kpis, the
  // real attention/flow KPIs), replacing the axis-top-segment filler cards
  // (Danny 24-08: "KPI row heeft totaal geen KPI"). 'leads' STAYS on the axis
  // family: the suite endpoint's validation does not yet accept the `phase`
  // narrowing the Leads position needs (asked CMBE, WAVE-1B-CONTRACTVRAGEN-CMBE
  // punt 4) — an unnarrowed suite under a Leads heading would show all-candidate
  // numbers over leads-only charts.
  candidates: 'fixed',
  leads: 'axis',
  // KPI-CUSTOMERS-SIGNALS-1: the Klanten position's strip is now the report's
  // own nine STANDING signal kpis[] cards (server predicate == drill predicate),
  // replacing the axis-topsegment filler cards — mirrors the candidates/
  // applications suite moves above. Prospects has no signal suite (see the
  // CUSTOMERS_SIGNAL_LABEL_KEYS comment) so it stays on the axis family.
  customers: 'fixed',
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
  // 'prospects' keeps the axis-topsegment strip — customers-only KPI-CUSTOMERS-
  // SIGNALS-1 converted the Klanten position to the fixed signal suite above
  // (REPORT_KPI_FIXED_CATALOG.customers); prospects still has no signal suite
  // (see the CUSTOMERS_SIGNAL_LABEL_KEYS comment) so it is untouched.
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
  // The candidates suite (CandidatesReport::kpis, K-169 family) — nine real
  // attention/flow KPIs, each sharing its predicate with its own drill.
  candidates: [
    { key: 'inflow', labelKey: 'candidates.kpi.inflow' },
    { key: 'outflow', labelKey: 'candidates.kpi.outflow' },
    { key: 'no_followup', labelKey: 'candidates.kpi.noFollowup' },
    { key: 'status_stale', labelKey: 'candidates.kpi.statusStale' },
    { key: 'no_cv', labelKey: 'candidates.kpi.noCv' },
    { key: 'document_expiring', labelKey: 'candidates.kpi.documentExpiring' },
    { key: 'availability_due', labelKey: 'candidates.kpi.availabilityDue' },
    { key: 'no_contact', labelKey: 'candidates.kpi.noContact' },
    { key: 'active_conversations', labelKey: 'candidates.kpi.activeConversations' },
  ],
  // KPI-CUSTOMERS-SIGNALS-1: the Klanten position's nine cards are now the
  // report's own STANDING signal kpis[] suite verbatim (server predicate ==
  // drill predicate via /reports/customers/kpi-drill) — CUSTOMERS_SIGNAL_LABEL_KEYS
  // above is the one place the key→i18n-suffix mapping is spelled out, consumed
  // both here and by CustomersReport.tsx so the two can never drift.
  customers: Object.entries(CUSTOMERS_SIGNAL_LABEL_KEYS).map(([signalKey, i18nSuffix]) => ({
    key: signalKey, labelKey: `customers.kpis.${i18nSuffix}`,
  })),
  // KPI-VAC-1 (CMBE 28-08, commit eb3af985): the strip reads the server's own
  // nine-card kpis[] suite verbatim (BuildsVacancyKpis), mirroring KPI-MATCHES-1/
  // KPI-OPP-1 — replaces the old ad-hoc summary/top-segment cards (value and
  // drill now share one backend predicate per key via /reports/vacancies/kpis/drill).
  // Keys match the server's `key` field exactly (snake_case); avg_time_to_fill_days
  // (ttf) and the topIndustry/topOwner/topFunction/topBranch/adviceStale spares
  // left the strip with the flip — ttf stays reachable in VacancyDepthSections.
  vacancies: [
    { key: 'total', labelKey: 'vacancies.kpi.total' },
    { key: 'open', labelKey: 'vacancies.kpi.open' },
    { key: 'filled', labelKey: 'vacancies.kpi.filled' },
    { key: 'fill_rate', labelKey: 'vacancies.kpi.fillRate' },
    { key: 'stale_online', labelKey: 'vacancies.kpi.staleOnline' },
    { key: 'long_concept', labelKey: 'vacancies.kpi.longConcept' },
    { key: 'no_matches', labelKey: 'vacancies.kpi.noMatches' },
    { key: 'closing_soon', labelKey: 'vacancies.kpi.closingSoon' },
    { key: 'customers_count', labelKey: 'vacancies.kpi.customersCount' },
  ],
  // KPI-OPP-1 (CMBE 27-08, commit eb3af985): the strip reads the server kpis[]
  // suite — the catalogue is that suite's own nine keys, replacing the old
  // summary/derived/top-spare cards (value and drill now share one predicate,
  // mirrors KPI-MATCHES-1/KPI-TAKEN-1).
  opportunities: [
    { key: 'total', labelKey: 'opportunities.kpi.total' },
    { key: 'open', labelKey: 'opportunities.kpi.open' },
    { key: 'won', labelKey: 'opportunities.kpi.won' },
    { key: 'lost', labelKey: 'opportunities.kpi.lost' },
    { key: 'win_rate', labelKey: 'opportunities.kpi.winRate' },
    { key: 'open_value', labelKey: 'opportunities.kpi.openValue' },
    { key: 'stale', labelKey: 'opportunities.kpi.stale' },
    { key: 'closing_soon', labelKey: 'opportunities.kpi.closingSoon' },
    { key: 'overdue', labelKey: 'opportunities.kpi.overdue' },
  ],
  // KPI-TAKEN-1 (naronde wave 1b): the tasks strip reads the server kpis[]
  // suite — the catalogue is that suite's own nine keys, replacing the old
  // summary/derived/top-spare cards (value and drill now share one predicate).
  tasks: [
    { key: 'total', labelKey: 'tasks.kpi.total' },
    { key: 'open', labelKey: 'tasks.kpi.open' },
    { key: 'overdue', labelKey: 'tasks.kpi.overdue' },
    { key: 'done_in_period', labelKey: 'tasks.kpi.doneInPeriod' },
    { key: 'created_in_period', labelKey: 'tasks.kpi.createdInPeriod' },
    { key: 'due_today', labelKey: 'tasks.kpi.dueToday' },
    { key: 'due_this_week', labelKey: 'tasks.kpi.dueThisWeek' },
    { key: 'without_assignee', labelKey: 'tasks.kpi.withoutAssignee' },
    { key: 'avg_completion_days', labelKey: 'tasks.kpi.avgCompletionDays' },
  ],
  // KPI-MATCHES-1 (CMBE 27-08, BuildsMatchKpis): the strip reads the server's
  // own nine-card kpis[] suite verbatim, mirroring outreach/tasks/applications —
  // replaces the old ad-hoc origin/placements/derived-stat cards (value and
  // drill now share one backend predicate per key).
  matches: [
    { key: 'total', labelKey: 'matches.kpi.total' },
    { key: 'new_in_period', labelKey: 'matches.kpi.newInPeriod' },
    { key: 'active', labelKey: 'matches.kpi.active' },
    { key: 'expiring_soon', labelKey: 'matches.kpi.expiringSoon' },
    { key: 'terminated_in_period', labelKey: 'matches.kpi.terminatedInPeriod' },
    { key: 'renewals_in_period', labelKey: 'matches.kpi.renewalsInPeriod' },
    { key: 'without_end_date', labelKey: 'matches.kpi.withoutEndDate' },
    { key: 'avg_duration_days', labelKey: 'matches.kpi.avgDurationDays' },
    { key: 'reach_rate', labelKey: 'matches.kpi.reachRate' },
  ],
  // CMBE K-191 (commit 00e72f45): the server's own nine-card kpis[] suite,
  // in catalog order — replaces the old ad-hoc summary/top-segment cards.
  outreach: [
    { key: 'total_targets', labelKey: 'outreach.kpi.totalTargets' },
    { key: 'open_todo', labelKey: 'outreach.kpi.openTodo' },
    { key: 'called_in_period', labelKey: 'outreach.kpi.calledInPeriod' },
    { key: 'reached', labelKey: 'outreach.kpi.reached' },
    { key: 'not_reached', labelKey: 'outreach.kpi.notReached' },
    { key: 'conversion_pct', labelKey: 'outreach.kpi.conversionPct' },
    { key: 'campaigns_active', labelKey: 'outreach.kpi.campaignsActive' },
    { key: 'campaigns_done_in_period', labelKey: 'outreach.kpi.campaignsDoneInPeriod' },
    { key: 'due_today', labelKey: 'outreach.kpi.dueToday' },
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
  // 'candidates' unpinned since its move to the fixed family (suite strip is
  // fully reorderable, like applications/whatsapp).
  leads: 'total',
  prospects: 'total',
  // 'customers' unpinned since its move to the fixed family (KPI-CUSTOMERS-
  // SIGNALS-1) — the nine signal keys ARE the whole reorderable strip, no
  // separate pinned "total" card any more (mirrors outreach/tasks/applications).
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
  // 'customers' moved to the fixed family (KPI-CUSTOMERS-SIGNALS-1) — its old
  // axis-cap entry is gone with it; 'candidates' is fixed-family too (dead
  // leftover from before that move, untouched here — out of this lane's scope).
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
