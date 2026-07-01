/**
 * Customer list display preferences — how the customer table renders, kept with
 * the other customer settings. Labels/descriptions live in i18n under
 * `customerDisplay.*` in the settings namespace. Mirrors candidateDisplay.
 */
export default {
  i18nKey: 'customerDisplay',
  fields: [
    // Status carries meaning → coloured chip ON by default; Koios advice OFF.
    { key: 'customer_table_color_status', type: 'toggle', default: true },
    { key: 'customer_table_color_koios',  type: 'toggle', default: false },
    // Owner avatar: account-manager colour (on, default) vs. neutral grey (off).
    { key: 'customer_table_color_owner',  type: 'toggle', default: true },
  ],
}
