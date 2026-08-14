/**
 * taskLinkTypes — the shared task-link vocabulary. What matters here is the
 * CONTRACT with the backend (measured 08-08 against TaskLinkResolver::MODELS,
 * which both StoreTaskRequest and UpdateTaskRequest validate `links.*.type`
 * against): every offered token must be one the API accepts, and a token whose
 * list endpoint does not exist must NOT be offered (§3 — no picker that cannot
 * fill itself).
 */
import { describe, it, expect } from 'vitest'
import { TASK_LINK_ENDPOINTS, TASK_LINK_TYPES, TASK_LINK_PAGE } from './taskLinkTypes'

// The backend's own vocabulary, copied from TaskLinkResolver::MODELS (14-08, final: 14 tokens).
const BACKEND_TOKENS = [
  'candidate', 'application', 'vacancy', 'match', 'customer', 'opportunity',
  'location', 'customer_location', 'department', 'contact', 'workflow',
  'outreach_campaign', 'conversation', 'task',
]

describe('taskLinkTypes', () => {
  it('offers only tokens the API accepts', () => {
    TASK_LINK_TYPES.forEach(token => expect(BACKEND_TOKENS).toContain(token))
  })

  it('offers the couplings Danny asked for: bedrijf, locatie, afdeling, contactpersoon', () => {
    expect(TASK_LINK_TYPES).toEqual(expect.arrayContaining(['customer', 'location', 'department', 'contact']))
  })

  it('does NOT offer customer_location — it has no global list route (GET /customer-locations → 404)', () => {
    expect(TASK_LINK_TYPES).not.toContain('customer_location')
  })

  it('gives every offered token a real endpoint and label function', () => {
    TASK_LINK_TYPES.forEach(token => {
      const cfg = TASK_LINK_ENDPOINTS[token]
      expect(cfg.url.startsWith('/')).toBe(true)
      expect(cfg.label({ id: 'x' })).toBeTruthy()
    })
  })

  it('labels person-shaped rows from first/last name, with an id fallback', () => {
    expect(TASK_LINK_ENDPOINTS.candidate.label({ id: '1', first_name: 'Piet', last_name: 'Jansen' })).toBe('Piet Jansen')
    expect(TASK_LINK_ENDPOINTS.candidate.label({ id: '1' })).toBe('#1')
  })

  it('only maps click-through pages for entities whose page honours the open intent', () => {
    Object.keys(TASK_LINK_PAGE).forEach(token => expect(TASK_LINK_TYPES).toContain(token))
    // opportunities page has no useOpenFromIntent — a click there would switch
    // pages without opening the record, so it stays plain text (§3).
    expect(TASK_LINK_PAGE.opportunity).toBeUndefined()
  })

  it('offers the three new backend tokens (bellijst, WhatsApp-gesprek, andere taak) with real endpoints', () => {
    expect(TASK_LINK_TYPES).toEqual(expect.arrayContaining(['outreach_campaign', 'conversation', 'task']))
    expect(TASK_LINK_ENDPOINTS.outreach_campaign.url).toBe('/outreach-campaigns')
    expect(TASK_LINK_ENDPOINTS.conversation.url).toBe('/conversations')
    expect(TASK_LINK_ENDPOINTS.task.url).toBe('/tasks')
  })

  it('labels a conversation row from the candidate identity, falling back to the phone number then the id', () => {
    expect(TASK_LINK_ENDPOINTS.conversation.label({ id: '1', candidate: { first_name: 'Piet', last_name: 'Jansen' } })).toBe('Piet Jansen')
    expect(TASK_LINK_ENDPOINTS.conversation.label({ id: '1', phone_number: '+31612345678' })).toBe('+31612345678')
    expect(TASK_LINK_ENDPOINTS.conversation.label({ id: '1' })).toBe('#1')
  })

  it('keeps location (own branch) and customer_location (a customer\'s site) as distinct, non-overlapping tokens', () => {
    // location IS offered with its own endpoint; customer_location is deliberately
    // excluded (no global list route yet) so its label never appears attached to
    // an actual picker — but the two tokens must never share a url or a label fn.
    expect(TASK_LINK_TYPES).toContain('location')
    expect(TASK_LINK_TYPES).not.toContain('customer_location')
    expect(TASK_LINK_ENDPOINTS.customer_location).toBeUndefined()
  })
})
