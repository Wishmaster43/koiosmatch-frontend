/**
 * Outreach (bellijsten) list display preferences — how the campaigns table
 * renders its chips. One toggle per coloured column; off = plain text.
 * Mirrors candidateDisplay/customerDisplay. Labels/descriptions live in i18n
 * under `outreachDisplay.*` (settings ns).
 */
export default {
  i18nKey: 'outreachDisplay',
  fields: [
    // Channel + status carry meaning → coloured chip ON by default.
    { key: 'outreach_table_color_channel', type: 'toggle', default: true },
    { key: 'outreach_table_color_status',  type: 'toggle', default: true },
    // Owner avatar: colour (on, default; neutral until the API carries one) vs. grey (off).
    { key: 'outreach_table_color_owner',   type: 'toggle', default: true },
  ],
}
