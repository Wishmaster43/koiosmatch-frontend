/**
 * Customer vacancy-visibility DEFAULTS — the tenant-wide starting value for the
 * three per-customer flags (hide company name / show in "my vacancies" / exclude
 * from sourcing), moved out of the customer's Overview tab into its own
 * VacancySettingsTab (Danny 27-07: "Dit moet default instelbaar zijn via
 * Instellingen en per klant kan er afgeveken worden"). The customer record only
 * stores a plain boolean (no null/"unset" state), so this default is read by
 * VacancySettingsTab purely for COMPARISON — "does this customer follow the
 * tenant default or deviate" — never silently applied to existing records.
 */
export default {
  i18nKey: 'customerVacancyDefaults',
  fields: [
    { key: 'customer_default_hide_company_name', type: 'toggle', default: false },
    { key: 'customer_default_show_in_vacancies', type: 'toggle', default: true },
    { key: 'customer_default_exclude_from_sourcing', type: 'toggle', default: false },
  ],
}
