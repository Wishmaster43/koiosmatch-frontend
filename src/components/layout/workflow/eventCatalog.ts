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
  // Danny 23-07 ("alle events erbij"): the COMPLETE dispatched vocabulary —
  // verified against every WorkflowDispatcher::dispatch() call site in
  // koiosmatch-api (TriggerModule::configSchema mirrors this same list).
  'application.stage_changed',
  'match.created',
  'candidate.created',
  'candidate.birthday',
  'candidate.address_changed',
  'candidate.reactivated',
  'candidate.retention_due',
  'appointment.upcoming',
  'facebook.lead_received',
  'backoffice.link.updated',
  'candidate.phase_changed',
  'candidate.status_changed',
  'candidate.type_changed',
  'contract.signed',
  // EINDAUDIT-BUILDER-1 (CMBE 2026-08-06): ten more dispatch sites that were
  // already live server-side but never pickable here — re-verified 2026-08-06
  // against TriggerModule::configSchema() + each dispatcher call site
  // (Application::171/179, Vacancy::161-162, MatchTerminationService::77-78,
  // DispatchExpiringMatchAlerts::171/181-182, CandidateAvailability::52-53,
  // DispatchExpiringDocumentAlerts::114-115, DispatchNoContactDueEvents::116-117,
  // Appointment::102, WhatsAppConnectionMonitor::100/118).
  'application.created',
  'vacancy.status_changed',
  'candidate.availability_changed',
  'candidate.no_contact',
  'candidate.document_expiring',
  'match.expiring',
  'match.terminated',
  'appointment.created',
  'whatsapp.connection_down',
  'whatsapp.connection_restored',
] as const

export type WorkflowEventKey = (typeof WORKFLOW_EVENT_KEYS)[number]

// i18n keys can't contain the raw dotted event key (react-i18next reads '.'
// as a nesting separator), so the label lookup uses the sanitized form:
// t(`triggers.events.${eventKeyToI18nKey(key)}`) -> triggers.events.candidate_birthday
export function eventKeyToI18nKey(key: string): string {
  return key.replace(/\./g, '_')
}
