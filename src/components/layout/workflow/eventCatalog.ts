/**
 * Workflow event-trigger catalogue (BIRTHDAY-FLOW-2). A workflow with
 * `trigger_type: 'event'` fires on a backend domain event carried as
 * `trigger_config.event` (verified against WorkflowDispatcher::dispatch +
 * DispatchBirthdayEvents/DispatchAppointmentConfirmations/ProcessFacebookLeadJob
 * in koiosmatch-api — the dotted key, e.g. `candidate.birthday`, is what the
 * backend compares literally).
 *
 * There is no `/workflows/events` catalogue endpoint yet (checked
 * WorkflowController + routes/api/tenant/workflows.php, 2026-07-20), so this
 * mirrors the full vocabulary `TriggerModule::configSchema()` publishes
 * server-side (verified 2026-07-20, commits 4449103/de09f81) — grow it again
 * the moment backend-Claude ships another dispatch point (match.start is
 * template-only today, not a general-purpose picker option yet).
 */
export const WORKFLOW_EVENT_KEYS = [
  'application.stage_changed',
  'match.created',
  'candidate.birthday',
  'appointment.upcoming',
  'facebook.lead_received',
] as const

export type WorkflowEventKey = (typeof WORKFLOW_EVENT_KEYS)[number]

// i18n keys can't contain the raw dotted event key (react-i18next reads '.'
// as a nesting separator), so the label lookup uses the sanitized form:
// t(`triggers.events.${eventKeyToI18nKey(key)}`) -> triggers.events.candidate_birthday
export function eventKeyToI18nKey(key: string): string {
  return key.replace(/\./g, '_')
}
