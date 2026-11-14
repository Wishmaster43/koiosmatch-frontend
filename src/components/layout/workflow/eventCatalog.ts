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
  'match.reopened',
  'appointment.created',
  'whatsapp.connection_down',
  'whatsapp.connection_restored',
  // G32 (2026-08-08): seven more dispatch sites already live server-side —
  // re-verified against TriggerModule::configSchema() (koiosmatch-api,
  // app/Workflow/Modules/TriggerModule.php ~L68-89) and each call site:
  // Vacancy.php:123 (created), :181 (published), :190 (updated),
  // AiAgentWebhookController.php:50 (ai_agent.webhook_received),
  // InterviewEngine.php:179/366/368 (interview.started/completed/disqualified,
  // W13). FE catalogue now mirrors the backend vocabulary key-for-key (31/31).
  'vacancy.created',
  'vacancy.published',
  'vacancy.updated',
  'ai_agent.webhook_received',
  'interview.started',
  'interview.completed',
  'interview.disqualified',
  // S1 Lane A (KOIOS-ADVIES-OVERAL-1, CONTRACT-CHANGELOG 2026-09-04): six more
  // dispatch sites, re-verified against TriggerModule::configSchema() (koiosmatch-api,
  // app/Workflow/Modules/TriggerModule.php ~L68-72). Payload: `candidate.updated` =
  // {candidate_id, changed}, `application.updated` = {application_id, changed},
  // `customer.updated` = {customer_id, changed} (`changed` = changed column names
  // only, never values); `opportunity.created` = {opportunity_id};
  // `opportunity.updated` = {opportunity_id, changed}; `match.updated` = {id,
  // match_id, changed} (was webhook-only before this bundle).
  'candidate.updated',
  'application.updated',
  'customer.updated',
  'opportunity.created',
  'opportunity.updated',
  'match.updated',
  // REPAIR N5: 20 more dispatch sites already live server-side (verified against
  // TriggerModule::configSchema() ~L68-135, koiosmatch-api, full option array —
  // count matches: 57/57) but never pickable here. STILSTAND-1 family (dispatched
  // by candidates:status-stale-due / phase-stale-due / tasks:overdue-due /
  // conversations:unanswered-due / applications:stage-stale-due):
  'candidate.status_stale',
  'candidate.phase_stale',
  'task.overdue',
  'conversation.unanswered',
  'application.stage_stale',
  // KD10: five customer stagnation/lifecycle signals (customers:no-contact-due /
  // contract-ending-due / task-overdue-due / match-ending-due / vacancy-stale-due).
  'customer.no_contact',
  'customer.contract_ending',
  'customer.task_overdue',
  'customer.match_ending',
  'customer.vacancy_stale',
  // NOTIF-DATUMS-1: the six PDF date-signals (11i-11n), candidates:date-signals-due.
  'candidate.availability_upcoming',
  'candidate.availability_overdue',
  'candidate.leave_ending_soon',
  'candidate.leave_overdue',
  'candidate.unavailable_ending_soon',
  'candidate.unavailable_overdue',
  // PROPOSE-SEND-1 / STILSTAND family stragglers.
  'application.proposal_sent',
  // P11-FASE4: manual-archive event (CandidateBulkService::archive).
  'candidate.archived',
  // NOTIF-VERVAL-1: candidates:missing-cv-alerts (idempotent per day until resolved).
  'candidate.missing_cv',
  // K-247 Lane C: customer-contact retention review signal.
  'contact.retention_due',
  // TRIGGER-VOCAB-1 (KLEIN-BE-1, CONTRACT-CHANGELOG 2026-09-17): four dispatch
  // sites (opportunities:attention-due / vacancies:attention-due) that already
  // had a real WorkflowDispatcher producer and are used by seeded templates, but
  // were never PICKABLE here.
  'opportunity.closing_soon',
  'opportunity.stale',
  'vacancy.closing_soon',
  'vacancy.stale_online',
  // O22-FE lens (17-09): TriggerModule::configSchema() offers 66 keys; these five
  // (LIMIET-BEHEER-1 approval flow + SETTINGS-CATALOG blank fallback) were in the
  // webhook catalogue and the API enum but never pickable here.
  'match.approval_pending',
  'match.approval_overdue',
  'match.approved',
  'match.rejected',
  'settings.blank_fallback',
] as const

export type WorkflowEventKey = (typeof WORKFLOW_EVENT_KEYS)[number]

// i18n keys can't contain the raw dotted event key (react-i18next reads '.'
// as a nesting separator), so the label lookup uses the sanitized form:
// t(`triggers.events.${eventKeyToI18nKey(key)}`) -> triggers.events.candidate_birthday
export function eventKeyToI18nKey(key: string): string {
  return key.replace(/\./g, '_')
}

// HF-WORKFLOWS-1: the HelloFlex webhook events a `helloflex_inbound` start node
// can listen to. Keys mirror the HelloFlex event names in
// koiosmatch-api/docs/providers/helloflex-webhook-filters.json (CreateCandidate
// -> helloflex.candidate.created). Kept apart from WORKFLOW_EVENT_KEYS on
// purpose: that list is the exact mirror of TriggerModule::configSchema().
// `label` is the English source text of the select option (fieldOptions key).
export const HELLOFLEX_EVENTS = [
  { key: 'helloflex.candidate.created',      label: 'HelloFlex: candidate created', filter: 'CreateCandidate' },
  { key: 'helloflex.candidate.updated',      label: 'HelloFlex: candidate updated', filter: 'UpdateCandidate' },
  { key: 'helloflex.employer.created',       label: 'HelloFlex: employer created', filter: 'CreateEmployer' },
  { key: 'helloflex.employer.updated',       label: 'HelloFlex: employer updated', filter: 'UpdateEmployer' },
  { key: 'helloflex.cost_center.created',    label: 'HelloFlex: cost center created', filter: 'CreateCostCenter' },
  { key: 'helloflex.cost_center.updated',    label: 'HelloFlex: cost center updated', filter: 'UpdateCostCenter' },
  { key: 'helloflex.agency.created',         label: 'HelloFlex: agency created', filter: 'CreateAgency' },
  { key: 'helloflex.agency.updated',         label: 'HelloFlex: agency updated', filter: 'UpdateAgency' },
  { key: 'helloflex.activity.created',       label: 'HelloFlex: activity created', filter: 'CreateActivity' },
  { key: 'helloflex.activity.updated',       label: 'HelloFlex: activity updated', filter: 'UpdateActivity' },
  { key: 'helloflex.activity.deleted',       label: 'HelloFlex: activity deleted', filter: 'DeleteActivity' },
  { key: 'helloflex.contract.created',       label: 'HelloFlex: contract created', filter: 'CreateContract' },
  { key: 'helloflex.contract.updated',       label: 'HelloFlex: contract updated', filter: 'UpdateContract' },
  { key: 'helloflex.contract.deleted',       label: 'HelloFlex: contract deleted', filter: 'DeleteContract' },
  { key: 'helloflex.contract.state_changed', label: 'HelloFlex: contract state changed', filter: 'ContractStateChanged' },
  { key: 'helloflex.contract.new_version',   label: 'HelloFlex: contract new version created', filter: 'ContractNewVersionCreated' },
  { key: 'helloflex.timecard.deleted',       label: 'HelloFlex: timecard deleted', filter: 'DeleteTimecard' },
  { key: 'helloflex.illness.deleted',        label: 'HelloFlex: illness deleted', filter: 'DeleteIllness' },
] as const

// The 18 dotted keys, and the HelloFlex filter NAMES the webhook registration and the inbound module config use.
export const HELLOFLEX_EVENT_KEYS = HELLOFLEX_EVENTS.map(e => e.key)
export const HELLOFLEX_FILTER_NAMES = HELLOFLEX_EVENTS.map(e => e.filter)

// Event groups for pickers: `core` is the dispatched domain vocabulary, `helloflex` the provider webhook group.
export const WORKFLOW_EVENT_GROUPS = {
  core: WORKFLOW_EVENT_KEYS as readonly string[],
  helloflex: HELLOFLEX_EVENT_KEYS as readonly string[],
} as const
