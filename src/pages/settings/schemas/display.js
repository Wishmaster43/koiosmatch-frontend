/**
 * Display / list-size preferences. Labels, descriptions and units live in i18n
 * under `display.fields.<key>.*`.
 */
export default {
  i18nKey: 'display',
  fields: [
    { key: 'candidates_per_page', type: 'number', default: 500, min: 1 },
    { key: 'top_cities_n',        type: 'number', default: 10,  min: 1 },
    { key: 'shifts_detail_limit', type: 'number', default: 500, min: 1 },
    { key: 'activity_log_limit',  type: 'number', default: 200, min: 1 },
  ],
}
