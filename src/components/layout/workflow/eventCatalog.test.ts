/**
 * eventCatalog coverage guard (G32). Two properties must always hold for the
 * event-trigger picker: (1) the FE catalogue is an exact mirror of the backend's
 * dispatched vocabulary (TriggerModule::configSchema(), koiosmatch-api) — no
 * missing key (a real backend event the recruiter can never pick) and no extra
 * key (a fake affordance: a trigger that can never fire); (2) every catalogued
 * key's i18n label resolves in every shipped locale, never silently falling
 * back to the raw dotted key.
 */
import { describe, it, expect } from 'vitest'
import { WORKFLOW_EVENT_KEYS, eventKeyToI18nKey } from './eventCatalog'

// Manual mirror of TriggerModule::configSchema()'s `event.options` (koiosmatch-api,
// app/Workflow/Modules/TriggerModule.php ~L68-135) — every key here has a real
// WorkflowDispatcher::dispatch() call site backing it. REPAIR N5 (2026-09-04):
// re-counted the backend's FULL options array by hand — 66 keys (57 + 4 added by
// TRIGGER-VOCAB-1, KLEIN-BE-1 + the 5 approval/blank-fallback keys) — this list carries all 66; the two tests below
// make this an exact bidirectional mirror (no missing key, no fake affordance),
// not just a "contains" check.
const BACKEND_DISPATCHED_EVENTS = [
  'application.created', 'application.stage_changed', 'match.created', 'match.expiring', 'match.terminated',
  'candidate.created', 'candidate.birthday', 'candidate.address_changed', 'candidate.reactivated',
  'candidate.retention_due', 'candidate.document_expiring', 'candidate.availability_changed',
  'candidate.no_contact', 'appointment.upcoming', 'appointment.created', 'facebook.lead_received',
  'backoffice.link.updated', 'candidate.phase_changed', 'candidate.status_changed', 'candidate.type_changed',
  'contract.signed', 'vacancy.status_changed', 'vacancy.created', 'vacancy.published', 'vacancy.updated',
  'ai_agent.webhook_received', 'whatsapp.connection_down', 'whatsapp.connection_restored',
  'interview.started', 'interview.completed', 'interview.disqualified',
  // S1 Lane A (KOIOS-ADVIES-OVERAL-1, CONTRACT-CHANGELOG 2026-09-04).
  'candidate.updated', 'application.updated', 'customer.updated',
  'opportunity.created', 'opportunity.updated', 'match.updated',
  // REPAIR N5: the 20 keys the previous pass missed (STILSTAND-1, KD10,
  // NOTIF-DATUMS-1, PROPOSE-SEND-1, P11-FASE4, NOTIF-VERVAL-1, K-247 Lane C).
  'candidate.status_stale', 'candidate.phase_stale', 'task.overdue', 'conversation.unanswered',
  'application.stage_stale',
  'customer.no_contact', 'customer.contract_ending', 'customer.task_overdue',
  'customer.match_ending', 'customer.vacancy_stale',
  'candidate.availability_upcoming', 'candidate.availability_overdue',
  'candidate.leave_ending_soon', 'candidate.leave_overdue',
  'candidate.unavailable_ending_soon', 'candidate.unavailable_overdue',
  'application.proposal_sent', 'candidate.archived', 'candidate.missing_cv', 'contact.retention_due',
  // TRIGGER-VOCAB-1 (KLEIN-BE-1, CONTRACT-CHANGELOG 2026-09-17).
  'opportunity.closing_soon', 'opportunity.stale', 'vacancy.closing_soon', 'vacancy.stale_online',
  'match.approval_pending', 'match.approval_overdue', 'match.approved', 'match.rejected', 'settings.blank_fallback',
]

// Every shipped locale's workflows.json, loaded eagerly like registryI18n.test.ts does.
const workflowsLocales = import.meta.glob('../../../i18n/locales/*/workflows.json', { eager: true, import: 'default' }) as Record<string, {
  triggers?: { events?: Record<string, string> }
}>
const LOCALES = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']

describe('WORKFLOW_EVENT_KEYS · backend parity', () => {
  it('contains every event the backend dispatches (no missing trigger)', () => {
    const missing = BACKEND_DISPATCHED_EVENTS.filter(key => !(WORKFLOW_EVENT_KEYS as readonly string[]).includes(key))
    expect(missing, `catalogue is missing dispatched events: ${missing.join(', ')}`).toEqual([])
  })

  it('names no event the backend never dispatches (no fake affordance)', () => {
    const extra = (WORKFLOW_EVENT_KEYS as readonly string[]).filter(key => !BACKEND_DISPATCHED_EVENTS.includes(key))
    expect(extra, `catalogue has events with no backend dispatcher: ${extra.join(', ')}`).toEqual([])
  })

  it('has no duplicate keys', () => {
    expect(new Set(WORKFLOW_EVENT_KEYS).size).toBe(WORKFLOW_EVENT_KEYS.length)
  })

  // REPAIR N5 / TRIGGER-VOCAB-1: an explicit count pins the FULL mirror
  // (66/66), not just "no diff either way" — a future backend addition that
  // also updates BACKEND_DISPATCHED_EVENTS but not this number would still be caught.
  it('mirrors exactly 66 backend-dispatched events', () => {
    expect(BACKEND_DISPATCHED_EVENTS.length).toBe(66)
    expect(WORKFLOW_EVENT_KEYS.length).toBe(66)
  })
})

describe('WORKFLOW_EVENT_KEYS · i18n coverage', () => {
  for (const loc of LOCALES) {
    it(`${loc}/workflows.json has a resolved label for every catalogued event`, () => {
      const file = Object.entries(workflowsLocales).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/workflows.json not found`).toBeTruthy()
      const events = file?.triggers?.events ?? {}
      const missing = WORKFLOW_EVENT_KEYS
        .map(key => eventKeyToI18nKey(key))
        .filter(i18nKey => typeof events[i18nKey] !== 'string' || events[i18nKey].trim() === '')
      expect(missing, `missing triggers.events labels in ${loc}: ${missing.join(', ')}`).toEqual([])
    })
  }
})
