/**
 * Match list display preferences — how the matches table renders its chips.
 * One toggle per coloured column; off = plain text. The match board (Kanban)
 * keeps its own colours regardless. Mirrors candidateDisplay/taskDisplay.
 * Labels/descriptions live in i18n under `matchDisplay.*` (settings ns).
 */
export default {
  i18nKey: 'matchDisplay',
  fields: [
    // Status carries meaning → coloured chip ON by default.
    { key: 'match_table_color_status', type: 'toggle', default: true },
    // Owner avatar: colour (on, default) vs. neutral grey (off).
    { key: 'match_table_color_owner',  type: 'toggle', default: true },
  ],
}
