/**
 * webhookEvents — the outgoing-webhook event catalog (single source of truth for
 * the UI). Grouped by resource; a subscription filters on any subset of these
 * keys. The backend mirrors this list (GET /webhook-events) and emits the events;
 * we keep a static copy so the picker works even before that endpoint exists.
 *
 * Key format: `resource.action` (dot, snake). Note shift.scheduling.* carry an
 * extra payload field `scheduling_type` (schedule_in | schedule_out).
 */

// Display order = catalog order. Each group renders as a section in the picker.
export const EVENT_GROUPS = [
  { group: 'candidate', events: ['candidate.created', 'candidate.updated', 'candidate.deleted', 'candidate.status_changed', 'candidate.funnel_type_changed'] },
  { group: 'customer', events: ['customer.created', 'customer.updated', 'customer.deleted'] },
  { group: 'location', events: ['location.created', 'location.updated', 'location.deleted'] },
  { group: 'contact_person', events: ['contact_person.created', 'contact_person.updated', 'contact_person.deleted'] },
  { group: 'vacancy', events: ['vacancy.created', 'vacancy.updated', 'vacancy.deleted'] },
  { group: 'order', events: ['order.created', 'order.updated', 'order.deleted'] },
  { group: 'shift', events: ['shift.created', 'shift.updated', 'shift.deleted'] },
  { group: 'shift_scheduling', events: ['shift.scheduling.created', 'shift.scheduling.updated', 'shift.scheduling.deleted'] },
]

// Flat list of every event key (e.g. for "select all" and validation).
export const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events)

// The action is always the last dot-segment (created/updated/deleted/…).
export const actionOf = (eventKey) => String(eventKey).split('.').pop()
