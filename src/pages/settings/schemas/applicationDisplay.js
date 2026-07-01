/**
 * Application list display preferences — how the applications table renders, kept
 * with the other application settings. Mirrors candidateDisplay. Labels/descriptions
 * live in i18n under `applicationDisplay.*` in the settings namespace.
 */
export default {
  i18nKey: 'applicationDisplay',
  fields: [
    // Coloured chips/score vs. plain text — one toggle PER meaning-carrying column.
    // All ON by default (they carry meaning); the KPI row keeps its colours regardless.
    { key: 'application_table_color_score',  type: 'toggle', default: true },
    { key: 'application_table_color_phase',  type: 'toggle', default: true },
    { key: 'application_table_color_status', type: 'toggle', default: true },
    // Owner avatar: recruiter colour (on, default) vs. neutral grey (off).
    { key: 'application_table_color_owner',  type: 'toggle', default: true },
  ],
}
