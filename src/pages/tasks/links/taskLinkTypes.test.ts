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

// The backend's own vocabulary, copied from TaskLinkResolver::MODELS (08-08).
const BACKEND_TOKENS = [
  'candidate', 'application', 'vacancy', 'match', 'customer', 'opportunity',
  'location', 'customer_location', 'department', 'contact', 'workflow',
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
})
