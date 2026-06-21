/**
 * Shiftmanager dashboard KPIs — distinct from general/kpis (main dashboard), so
 * they use their own `sm_*` keys. Labels/units live in i18n under `smKpis.fields.<key>.*`.
 */
export default {
  i18nKey: 'smKpis',
  fields: [
    { key: 'sm_occupancy_target',     type: 'number', default: 90, min: 0, max: 100 },
    { key: 'sm_fill_rate_target',     type: 'number', default: 95, min: 0, max: 100 },
    { key: 'sm_open_shifts_warning',  type: 'number', default: 10, min: 0 },
    { key: 'sm_no_show_threshold',    type: 'number', default: 5,  min: 0, max: 100 },
    { key: 'sm_filled_shifts_target', type: 'number', default: 50, min: 0 },
  ],
}
