/**
 * Dashboard KPI targets, split by category so Settings → KPIs shows one sub-tab
 * per area (Leads / Candidates / Applications / Customers / Locations / Departments /
 * Contacts / Tasks / Call lists / Matches). Field labels stay under the shared
 * `kpis.fields.<key>` i18n; each sub-tab's title comes from `titleI18n`.
 * Add a KPI = add a line to the right category + its i18n strings.
 */
const base = { i18nKey: 'kpis' }

// Shared "no-contact alert" block — a months threshold + a never-contacted toggle.
// Feeds the dashboard stale/never KPIs so the 6-month rule is tenant-configurable.
const noContactAlert = [
  { key: 'no_contact_alert_months', type: 'number', default: 6, min: 1, max: 60 },
  { key: 'never_contacted_alert', type: 'toggle', default: true },
]

// Leads — top-of-funnel intake targets.
export const kpisLeads = {
  ...base, titleI18n: 'nav.kpis_leads',
  fields: [
    { key: 'new_candidates_target', type: 'number', default: 15, min: 0 },
  ],
}

// Candidates — pool health (churn + averaging window) + no-contact alerts.
export const kpisCandidates = {
  ...base, titleI18n: 'nav.kpis_candidates',
  fields: [
    { key: 'churn_warning_threshold', type: 'number', default: 10, min: 0 },
    { key: 'avg_candidates_window',   type: 'number', default: 12, min: 0 },
    // Active-conversation window (CONV-DRILLDOWN-FE): drives the drawer's
    // is_active badge AND the "actieve gesprekken" KPI (same server derivation).
    { key: 'conversation_active_weeks', type: 'number', default: 4, min: 1, max: 52 },
    // No-followup window (walkthrough 21-08): workdays without an open task,
    // appointment or contact before the "geen opvolging" KPI counts a candidate —
    // server-derived (default 5, clamped 1-60); this is its one settings surface.
    { key: 'candidate_no_followup_workdays', type: 'number', default: 5, min: 1, max: 60 },
    ...noContactAlert,
  ],
}

// Applications — funnel responsiveness.
export const kpisApplications = {
  ...base, titleI18n: 'nav.kpis_applications',
  fields: [
    { key: 'response_rate_target', type: 'number', default: 80, min: 0, max: 100 },
  ],
}

// Customers — client-side occupancy.
export const kpisCustomers = {
  ...base, titleI18n: 'nav.kpis_customers',
  fields: [
    { key: 'occupancy_target', type: 'number', default: 85, min: 0, max: 100 },
  ],
}

// Locations — occupancy target measured per location.
export const kpisLocations = {
  ...base, titleI18n: 'nav.kpis_locations',
  fields: [
    { key: 'occupancy_target', type: 'number', default: 85, min: 0, max: 100 },
  ],
}

// Departments — occupancy target measured per department.
export const kpisDepartments = {
  ...base, titleI18n: 'nav.kpis_departments',
  fields: [
    { key: 'occupancy_target', type: 'number', default: 85, min: 0, max: 100 },
  ],
}

// Contact persons — same no-contact alerts as candidates (client relationship hygiene).
export const kpisContacts = {
  ...base, titleI18n: 'nav.kpis_contacts',
  fields: [
    ...noContactAlert,
  ],
}

// Tasks — workload thresholds (open volume + overdue warning).
export const kpisTasks = {
  ...base, titleI18n: 'nav.kpis_tasks',
  fields: [
    { key: 'open_tasks_target', type: 'number', default: 20, min: 0 },
    { key: 'overdue_warning_threshold', type: 'number', default: 5, min: 0 },
  ],
}

// Call lists — outreach cadence (daily target + uncalled backlog warning).
export const kpisCalllists = {
  ...base, titleI18n: 'nav.kpis_calllists',
  fields: [
    { key: 'daily_calls_target', type: 'number', default: 20, min: 0 },
    { key: 'uncalled_warning_threshold', type: 'number', default: 25, min: 0 },
  ],
}

// Matches — output targets.
export const kpisMatches = {
  ...base, titleI18n: 'nav.kpis_matches',
  fields: [
    { key: 'placements_target', type: 'number', default: 10, min: 0 },
    { key: 'fill_rate_target', type: 'number', default: 85, min: 0, max: 100 },
  ],
}

// Opportunities — pipeline day-window thresholds (KPI-DREMPELS-FE-1): how long a
// deal may sit without a stage change before it counts as stale, and how close to
// its expected close date before it counts as closing soon. Closed deals never count.
export const kpisOpportunities = {
  ...base, titleI18n: 'nav.kpis_opportunities',
  fields: [
    { key: 'opportunity_stale_days', type: 'number', default: 30, min: 1, max: 365 },
    { key: 'opportunity_closing_soon_days', type: 'number', default: 14, min: 1, max: 365 },
  ],
}

// Vacancies — closing-soon day-window threshold (KPI-DREMPELS-FE-1). The sibling
// staleness key (`vacancy_advice_stale_days`) is NOT duplicated here: it already has
// its one write path on the Koios-advice screen (KoiosAdviceSettings.tsx) — ONE
// SOURCE PER KEY (SETTINGS-TABS-FIX-1 review). `subtitleI18n` overrides the shared
// `kpis.subtitle` for this one tab so the cross-reference is visible right here.
export const kpisVacancies = {
  ...base, titleI18n: 'nav.kpis_vacancies', subtitleI18n: 'kpis.vacanciesSubtitle',
  fields: [
    { key: 'vacancy_closing_soon_days', type: 'number', default: 7, min: 1, max: 365 },
  ],
}
