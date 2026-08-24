/**
 * kpiKeyMap — the ONE bidirectional map between the dashboard's LOCAL tile ids
 * (KPI_ROWS/templates vocabulary: 'stale', 'activeConv', …) and the SERVER's
 * kpis/kpi_row/kpi-catalog keys (K-168/K-173: 'stale_6m',
 * 'active_conversations', …). Measured pair-for-pair against
 * buildDashboardKpis' own value reads — a second hand-kept copy of this table
 * anywhere else is a finding (Opus K2-slotgolf B1: the settings screen spoke
 * local ids against the server catalogue and every PUT would have 422'd).
 */

export const LOCAL_TO_SERVER: Record<string, string> = {
  candidates:        'candidates_total',
  stale:             'stale_6m',
  never:             'never_contacted',
  tasks:             'tasks',
  opps:              'opps_total',
  pipeline:          'pipeline_value',
  placements:        'placements',
  intakes:           'intake_planned',
  fillRate:          'fill_rate',
  openVacancies:     'open_vacancies',
  incompleteRuns:    'incomplete_runs',
  activeConv:        'active_conversations',
  missingDocs:       'missing_documents',
  expiringContracts: 'expiring_contracts',
  couplingErrors:    'coupling_errors',
  openShifts:        'open_shifts',
  occupancy:         'occupancy',
  escalations:       'escalations',
  failedWf:          'failed_workflows',
  tasksOverdue:      'tasks_overdue',
  uncalledCallist:   'calllist_uncalled',
  expiringOpps:      'expiring_opps',
  tooLongInStage:    'app_too_long_in_stage',
  missingApptApps:   'app_missing_appointment',
}

export const SERVER_TO_LOCAL: Record<string, string> = Object.fromEntries(
  Object.entries(LOCAL_TO_SERVER).map(([local, server]) => [server, local]),
)

/** Server key list → local tile ids, silently dropping keys this build doesn't know. */
export const serverKeysToLocal = (keys: string[]): string[] =>
  keys.map(k => SERVER_TO_LOCAL[k]).filter((k): k is string => k != null)

/** Local tile ids → server keys, silently dropping ids without a server key. */
export const localIdsToServer = (ids: string[]): string[] =>
  ids.map(id => LOCAL_TO_SERVER[id]).filter((k): k is string => k != null)
