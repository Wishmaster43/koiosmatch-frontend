/**
 * Dashboard KPI targets, split by category so Settings → KPIs shows one sub-tab
 * per area (Leads / Candidates / Applications / Customers). Field labels stay under
 * the shared `kpis.fields.<key>` i18n; each sub-tab's title comes from `titleI18n`.
 * Add a KPI = add a line to the right category + its i18n strings.
 */
const base = { i18nKey: 'kpis' }

// Leads — top-of-funnel intake targets.
export const kpisLeads = {
  ...base, titleI18n: 'nav.kpis_leads',
  fields: [
    { key: 'new_candidates_target', type: 'number', default: 15, min: 0 },
  ],
}

// Candidates — pool health (churn + averaging window).
export const kpisCandidates = {
  ...base, titleI18n: 'nav.kpis_candidates',
  fields: [
    { key: 'churn_warning_threshold', type: 'number', default: 10, min: 0 },
    { key: 'avg_candidates_window',   type: 'number', default: 12, min: 0 },
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
