/**
 * webhookEvents coverage guard. Two properties must always hold for the outgoing
 * webhook picker, mirroring eventCatalog.test.ts's spirit for the TRIGGER side:
 * (1) REPAIR N6 — the FE catalogue is an EXACT bidirectional mirror of
 * `config/webhooks.php` (koiosmatch-api) — no missing key (a real backend event a
 * tenant could never subscribe to) and no extra key (a fake affordance that 422s
 * against `WebhookSubscription::eventKeys()` the moment someone picks it — this is
 * exactly how `location.*`/`contact_person.*`/`order.*`/`shift.*` shipped as dead
 * options); (2) every catalogued group/action resolves a real label in every
 * shipped locale's settings.json, never silently falling back to the raw key.
 */
import { describe, it, expect } from 'vitest'
import { EVENT_GROUPS, ALL_EVENTS, actionOf } from './webhookEvents'

// Manual mirror of config/webhooks.php's `events` array (koiosmatch-api) — hand-
// counted 2026-09-04: 59 rows, 13 groups. Re-verify by re-grepping
// `'key' => '...'` in that file if this ever needs updating.
const BACKEND_WEBHOOK_EVENTS = [
  'candidate.created', 'candidate.updated', 'candidate.status_changed', 'candidate.reactivated',
  'candidate.archived', 'candidate.document_expiring', 'candidate.availability_changed',
  'candidate.no_contact', 'candidate.missing_cv', 'candidate.availability_upcoming',
  'candidate.availability_overdue', 'candidate.leave_ending_soon', 'candidate.leave_overdue',
  'candidate.unavailable_ending_soon', 'candidate.unavailable_overdue', 'candidate.birthday',
  'candidate.retention_due', 'candidate.status_stale', 'candidate.phase_stale',
  'application.created', 'application.updated', 'application.stage_changed',
  'application.proposal_sent', 'application.stage_stale',
  'match.created', 'match.updated', 'match.deleted', 'match.terminated', 'match.expiring',
  'vacancy.created', 'vacancy.status_changed', 'vacancy.published', 'vacancy.updated',
  'vacancy.stale_online', 'vacancy.closing_soon',
  'task.created', 'task.overdue',
  'appointment.created', 'appointment.upcoming',
  'message.received', 'message.sent', 'whatsapp.connection_down',
  'whatsapp.connection_restored', 'conversation.unanswered',
  'backoffice.link.updated',
  'ai_agent.webhook_received',
  'contact.retention_due', 'customer.updated', 'customer.no_contact',
  'customer.contract_ending', 'customer.task_overdue', 'customer.match_ending',
  'customer.vacancy_stale',
  'facebook.lead_received',
  'interview.started', 'interview.completed', 'interview.disqualified',
  'opportunity.created', 'opportunity.updated',
]

// Every shipped locale's settings.json, loaded like localeParity.test.ts does.
const settingsLocales = import.meta.glob('../../../../i18n/locales/*/settings.json', { eager: true, import: 'default' })
const LOCALES = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']

describe('EVENT_GROUPS · backend parity (REPAIR N6)', () => {
  it('mirrors exactly 59 backend webhook events', () => {
    expect(BACKEND_WEBHOOK_EVENTS.length).toBe(59)
    expect(ALL_EVENTS.length).toBe(59)
  })

  it('contains every event the backend catalogue has (no missing subscription option)', () => {
    const missing = BACKEND_WEBHOOK_EVENTS.filter(key => !ALL_EVENTS.includes(key))
    expect(missing, `catalogue is missing backend events: ${missing.join(', ')}`).toEqual([])
  })

  it('names no event the backend catalogue lacks (no 422-on-pick fake affordance)', () => {
    const extra = ALL_EVENTS.filter(key => !BACKEND_WEBHOOK_EVENTS.includes(key))
    expect(extra, `catalogue has events with no backend entry: ${extra.join(', ')}`).toEqual([])
  })

  it('has no duplicate event keys across groups', () => {
    expect(new Set(ALL_EVENTS).size).toBe(ALL_EVENTS.length)
  })
})

describe('EVENT_GROUPS · i18n coverage', () => {
  const groupsUsed = [...new Set(EVENT_GROUPS.map(g => g.group))]
  const actionsUsed = [...new Set(ALL_EVENTS.map(actionOf))]

  for (const loc of LOCALES) {
    it(`${loc}/settings.json has a label for every catalogued group`, () => {
      const file = Object.entries(settingsLocales).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/settings.json not found`).toBeTruthy()
      const groups = file?.webhooks?.events?.groups ?? {}
      const missing = groupsUsed.filter(g => typeof groups[g] !== 'string' || groups[g].trim() === '')
      expect(missing, `missing webhooks.events.groups labels in ${loc}: ${missing.join(', ')}`).toEqual([])
    })

    it(`${loc}/settings.json has a label for every catalogued action`, () => {
      const file = Object.entries(settingsLocales).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/settings.json not found`).toBeTruthy()
      const actions = file?.webhooks?.events?.actions ?? {}
      const missing = actionsUsed.filter(a => typeof actions[a] !== 'string' || actions[a].trim() === '')
      expect(missing, `missing webhooks.events.actions labels in ${loc}: ${missing.join(', ')}`).toEqual([])
    })
  }
})
