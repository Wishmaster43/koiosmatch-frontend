/**
 * Opportunity (Kans) display preferences — how the Kansen table + KPIs present the
 * deal magnitude. Labels/descriptions live in i18n under `opportunityDisplay.*` in
 * the settings namespace. Mirrors candidateDisplay/customerDisplay.
 * Deal unit is now per-row (dealType.unit: euro/hours/quote), never tenant-wide (X-5-UNIT-PER-ROW).
 */
export default {
  i18nKey: 'opportunityDisplay',
  fields: [
    // Stage carries meaning → coloured chip ON by default.
    { key: 'opportunity_table_color_stage', type: 'toggle', default: true },
    // Owner avatar: colour (on, default) vs. neutral grey (off).
    { key: 'opportunity_table_color_owner', type: 'toggle', default: true },
  ],
}
