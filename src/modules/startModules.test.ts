/**
 * startModules.test — VERTREKMODULE-1 (Danny 30/31-08: "het begin is masterdata
 * van Koios"): the valid-start set contains every entity node plus the inbound
 * webhook, and never an action/send step.
 */
import { describe, it, expect } from 'vitest'
import { START_MODULE_TYPES } from './index'

describe('START_MODULE_TYPES · Koios master data + webhook only', () => {
  it('contains every entity node and the webhook', () => {
    for (const t of ['candidates', 'customers', 'vacancies', 'applications', 'tasks', 'matches', 'opportunities', 'planning', 'webhook',
      'sm_employees', 'sm_schedules', 'sm_candidates', 'sm_customers', 'sm_shifts',
      'candidate_filter', 'candidates_fetch', 'whatsapp_inbound']) {
      expect(START_MODULE_TYPES.has(t), t).toBe(true)
    }
  })

  it('never an action or send step', () => {
    for (const t of ['ai_agent', 'whatsapp_send', 'email_send', 'notification', 'tasks_create', 'router', 'wait', 'trigger']) {
      expect(START_MODULE_TYPES.has(t), t).toBe(false)
    }
  })
})
