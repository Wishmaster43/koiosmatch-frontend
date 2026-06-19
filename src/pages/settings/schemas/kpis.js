/**
 * KPI targets/thresholds. Labels, descriptions and units live in i18n under
 * `kpis.fields.<key>.*`. Add a KPI = add a line here + its i18n strings.
 */
export default {
  i18nKey: 'kpis',
  fields: [
    { key: 'new_candidates_target',   type: 'number', default: 15, min: 0 },
    { key: 'churn_warning_threshold', type: 'number', default: 10, min: 0 },
    { key: 'avg_candidates_window',   type: 'number', default: 12, min: 0 },
    { key: 'occupancy_target',        type: 'number', default: 85, min: 0, max: 100 },
    { key: 'response_rate_target',    type: 'number', default: 80, min: 0, max: 100 },
  ],
}
