/**
 * Shiftmanager dashboard KPIs — distinct from general/kpis (main dashboard), so
 * they use their own `sm_*` keys. Labels/units live in i18n under `smKpis.fields.<key>.*`.
 */
export default {
  i18nKey: 'smKpis',
  fields: [
    { key: 'sm_fill_rate_target',     type: 'number', default: 95, min: 0, max: 100 },
    { key: 'sm_filled_shifts_target', type: 'number', default: 50, min: 0 },
  ],
}
