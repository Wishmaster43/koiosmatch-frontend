/**
 * Candidate list display preferences — how the candidate table renders, kept with
 * the other candidate settings (not the generic "Weergave" section). Labels and
 * descriptions live in i18n under `candidateDisplay.*` in the settings namespace.
 */
export default {
  i18nKey: 'candidateDisplay',
  fields: [
    // Coloured chips vs. plain text — one toggle PER column. Off = plain text;
    // the KPI row keeps its colours regardless (it reads the lookups directly).
    { key: 'candidate_table_color_funnel', type: 'toggle', default: false },
    { key: 'candidate_table_color_type',   type: 'toggle', default: false },
    { key: 'candidate_table_color_pool',   type: 'toggle', default: false },
    { key: 'candidate_table_color_koios',  type: 'toggle', default: false },
    // Phase + deployability ("status") carry meaning → coloured chip ON by default.
    { key: 'candidate_table_color_phase',  type: 'toggle', default: true },
    { key: 'candidate_table_color_status', type: 'toggle', default: true },
    // Name avatar: per-gender colour (on) vs. one calm grey (off, default).
    { key: 'candidate_avatar_colored_by_gender', type: 'toggle', default: false },
    // Owner avatar: recruiter colour (on, default) vs. neutral grey (off).
    { key: 'candidate_table_color_owner',  type: 'toggle', default: true },
  ],
}
