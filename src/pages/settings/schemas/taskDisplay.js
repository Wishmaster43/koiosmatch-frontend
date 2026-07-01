/**
 * Task list display preferences — how the tasks table renders its chips. One toggle
 * per coloured column; off = plain text. The KPI row / board keep their colours
 * regardless. Labels + descriptions live in i18n under `taskDisplay.*` (settings ns).
 * Persisted via the generic Setting store (POST /settings), mirroring candidateDisplay.
 */
export default {
  i18nKey: 'taskDisplay',
  fields: [
    // Status, priority and type carry meaning → coloured chip ON by default.
    { key: 'task_table_color_status',   type: 'toggle', default: true },
    { key: 'task_table_color_priority', type: 'toggle', default: true },
    { key: 'task_table_color_type',     type: 'toggle', default: true },
  ],
}
