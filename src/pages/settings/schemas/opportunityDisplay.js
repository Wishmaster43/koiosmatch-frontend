/**
 * Opportunity (Kans) display preferences — how the Kansen table + KPIs present the
 * deal magnitude. Labels/descriptions live in i18n under `opportunityDisplay.*` in
 * the settings namespace. Mirrors candidateDisplay/customerDisplay.
 */
export default {
  i18nKey: 'opportunityDisplay',
  fields: [
    // Deal magnitude in hours (staffing) instead of euro. Off = euro (default).
    { key: 'opportunity_value_in_hours', type: 'toggle', default: false },
  ],
}
