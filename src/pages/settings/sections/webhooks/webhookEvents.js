/**
 * webhookEvents — the NETWORK-ERROR FALLBACK for the outgoing-webhook event
 * catalog (SETTINGS-WEBHOOK-EVENTS-DUP-1). `GET /webhook-events` is now the live
 * source of truth (fetched via `useWebhookEventCatalog`, which feeds EventCatalog/
 * WebhookCreate/WebhookDetail) — this static list renders ONLY when that request
 * fails, so the picker degrades instead of going blank. It is kept key-for-key
 * and group-for-group with `config/webhooks.php` (koiosmatch-api) so the fallback
 * stays a faithful stand-in; `webhookEvents.test.js` guards that parity.
 *
 * REPAIR N6 (2026-09-04): re-verified every key against config/webhooks.php by
 * hand (59 events). Five groups this file used to carry — `location`, `contact_person`,
 * `order`, `shift`, `shift.scheduling.*` — have NO backend catalogue entry at all
 * (grepped the whole backend: no dispatcher, no config row); subscribing to any of
 * them would 422 against `WebhookSubscription::eventKeys()`. Removed as a fake
 * affordance. `candidate.deleted`, `candidate.funnel_type_changed`, `customer.created`,
 * `customer.deleted`, `vacancy.deleted` were the same class of gap. Group NAMES now
 * match the backend's own `group` field verbatim (plural: candidates/applications/…)
 * instead of this file's old ad-hoc singular convention, so there is exactly one
 * taxonomy to keep in sync going forward.
 *
 * Key format: `resource.action` (dot, snake) — `backoffice.link.updated` is the one
 * three-segment key; `actionOf()` still resolves its action correctly (last segment).
 *
 * Payload notes (measured against the backend model hooks, CONTRACT-CHANGELOG
 * 2026-09-04 + config/webhooks.php's own inline comments): `candidate.updated` =
 * `{candidate_id, changed}`, `application.updated` = `{application_id, changed}`,
 * `customer.updated` = `{customer_id, changed}` — `changed` is the list of changed
 * COLUMN NAMES only, never values (bookkeeping-only saves are noise-filtered and
 * fire nothing). `opportunity.created` = `{opportunity_id}`; `opportunity.updated` =
 * `{opportunity_id, changed}`. `match.updated` = `{id, match_id, changed}` (the
 * generic lifecycle payload, `<entity>_id` added alongside `id`). `candidate.created`
 * = `{id, candidate_id, status, created_at}` (union of two former call sites). Every
 * `*_stale`/`*_overdue`/`*_upcoming`/`*_ending_soon` signal and `candidate.document_expiring`
 * carry ids (+ a date/day-count where relevant) only — never PII (§9).
 */

// Display order = catalog order = config/webhooks.php's own order. Each group
// renders as a section in the picker.
export const EVENT_GROUPS = [
  { group: 'candidates', events: [
    'candidate.created', 'candidate.updated', 'candidate.status_changed', 'candidate.reactivated',
    'candidate.archived', 'candidate.document_expiring', 'candidate.availability_changed',
    'candidate.no_contact', 'candidate.missing_cv', 'candidate.availability_upcoming',
    'candidate.availability_overdue', 'candidate.leave_ending_soon', 'candidate.leave_overdue',
    'candidate.unavailable_ending_soon', 'candidate.unavailable_overdue', 'candidate.birthday',
    'candidate.retention_due', 'candidate.status_stale', 'candidate.phase_stale',
  ] },
  { group: 'applications', events: [
    'application.created', 'application.updated', 'application.stage_changed',
    'application.proposal_sent', 'application.stage_stale',
  ] },
  { group: 'matches', events: [
    'match.created', 'match.updated', 'match.deleted', 'match.terminated', 'match.expiring',
  ] },
  { group: 'vacancies', events: [
    'vacancy.created', 'vacancy.status_changed', 'vacancy.published', 'vacancy.updated',
    'vacancy.stale_online', 'vacancy.closing_soon',
  ] },
  { group: 'tasks', events: ['task.created', 'task.overdue'] },
  { group: 'appointments', events: ['appointment.created', 'appointment.upcoming'] },
  // High-volume + carries personal data (message.received/sent) — Stage-2 delivery
  // minimises the body for these (§9), not this file's concern.
  { group: 'messages', events: [
    'message.received', 'message.sent', 'whatsapp.connection_down',
    'whatsapp.connection_restored', 'conversation.unanswered',
  ] },
  { group: 'backoffice', events: ['backoffice.link.updated'] },
  { group: 'ai', events: ['ai_agent.webhook_received'] },
  { group: 'customers', events: [
    'contact.retention_due', 'customer.updated', 'customer.no_contact',
    'customer.contract_ending', 'customer.task_overdue', 'customer.match_ending',
    'customer.vacancy_stale',
  ] },
  { group: 'leads', events: ['facebook.lead_received'] },
  { group: 'interviews', events: ['interview.started', 'interview.completed', 'interview.disqualified'] },
  // S1 A3: Opportunity dispatched zero events before this bundle — no tenant
  // could ever subscribe a webhook to a sales deal.
  { group: 'opportunities', events: ['opportunity.created', 'opportunity.updated'] },
]

// Flat list of every event key (e.g. for "select all" and validation).
export const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events)

// The action is always the LAST dot-segment (created/updated/deleted/…) — also
// correct for the one three-segment key, `backoffice.link.updated` -> `updated`.
export const actionOf = (eventKey) => String(eventKey).split('.').pop()
