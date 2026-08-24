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
  // Full-vocabulary completion (Danny: "ik moet er 9 hebben, waar is de rest
  // gebleven" — the server's default kpi_row carried keys this map did not know
  // and they fell out silently): every remaining K-168/K-173 key gets a tile.
  candidatesNew:     'candidates_new',
  noFollowup:        'no_followup',
  leadsPipeline:     'leads_pipeline',
  vacanciesActive:   'vacancies_active',
  intakesDone:       'intakes',
  matchesTotal:      'matches_total',
  messagesSent:      'messages_sent',
  shiftsPlanned:     'shifts_planned',
  // DASH-V3-UITROL-1 — the 18 v3 KPI keys (K-179, 2bf6418f), verbatim server names.
  matchesActive:      'matches_active',
  applicationsActive: 'applications_active',
  vacanciesStale:     'vacancies_stale',
  redeployDue:        'redeploy_due_14d',
  timeToSubmit:       'time_to_submit_avg',
  oppsNew:            'opps_new',
  oppsStalled:        'opps_stalled',
  oppsWinRate:        'opps_win_rate',
  customersActive:    'customers_active',
  customersProspect:  'customers_prospect',
  customersAtRisk:    'customers_at_risk',
  placementsIncomplete: 'placements_incomplete',
  documentsExpiring:  'documents_expiring_30d',
  openShifts48h:      'open_shifts_48h',
  shiftsUnconfirmed:  'shifts_unconfirmed',
  shiftsNoshowToday:  'shifts_noshow_today',
  shiftsCancelledToday: 'shifts_cancelled_today',
  candidatesAvailable: 'candidates_available',
}

export const SERVER_TO_LOCAL: Record<string, string> = {
  ...Object.fromEntries(Object.entries(LOCAL_TO_SERVER).map(([local, server]) => [server, local])),
  // 'matches' is the server's alias of the matches count (K-168) — it renders
  // as the same tile; writes canonicalise to 'matches_total'.
  matches: 'matchesTotal',
}

/** Server key list → local tile ids, silently dropping keys this build doesn't know. */
export const serverKeysToLocal = (keys: string[]): string[] =>
  keys.map(k => SERVER_TO_LOCAL[k]).filter((k): k is string => k != null)

/** Local tile ids → server keys, silently dropping ids without a server key. */
export const localIdsToServer = (ids: string[]): string[] =>
  ids.map(id => LOCAL_TO_SERVER[id]).filter((k): k is string => k != null)

// The eight roles the K-173/K-179 per-role endpoints know; every other
// dashboard_type shares the literal 'default' row (CMBE: "de default-rol heet
// letterlijk 'default'"). One shared resolver — the settings screen and the
// live dashboard must never disagree on this mapping.
// DASH-V3-UITROL-1 — 'planning' and 'readonly' got their own server-side role
// defaults (config/dashboard_kpis.php) alongside the v3 tranche; they must no
// longer fall back to 'default'.
const SPECIFIC_API_ROLES = ['recruitment', 'recruitment_manager', 'accountmanager', 'sales_manager', 'backoffice', 'planning', 'readonly']
export const apiRoleForType = (type: string): string =>
  SPECIFIC_API_ROLES.includes(type) ? type : 'default'
