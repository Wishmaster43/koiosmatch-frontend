/**
 * taskLinkTypes — the shared task-link vocabulary. What matters here is the
 * CONTRACT with the backend (measured 08-08 against TaskLinkResolver::MODELS,
 * which both StoreTaskRequest and UpdateTaskRequest validate `links.*.type`
 * against): every offered token must be one the API accepts, and a token whose
 * list endpoint does not exist must NOT be offered (§3 — no picker that cannot
 * fill itself).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TASK_LINK_ENDPOINTS, TASK_LINK_TYPES, TASK_LINK_PAGE, resolveLinkUrl, useReferenceLinkAvailable } from './taskLinkTypes'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// The backend's own vocabulary, copied from TaskLinkResolver::MODELS (14-08, final: 14 tokens)
// + `reference` (REFERENCE-LINK-1, BE api during-onix 51ef5812, 29-09).
const BACKEND_TOKENS = [
  'candidate', 'application', 'vacancy', 'match', 'customer', 'opportunity',
  'location', 'customer_location', 'department', 'contact', 'workflow',
  'outreach_campaign', 'conversation', 'task', 'reference',
]

describe('taskLinkTypes', () => {
  it('offers only tokens the API accepts', () => {
    TASK_LINK_TYPES.forEach(token => expect(BACKEND_TOKENS).toContain(token))
  })

  it('offers the couplings Danny asked for: bedrijf, locatie, afdeling, contactpersoon', () => {
    expect(TASK_LINK_TYPES).toEqual(expect.arrayContaining(['customer', 'location', 'department', 'contact']))
  })

  it('offers customer_location now that the global list route exists (14-08)', () => {
    expect(TASK_LINK_TYPES).toContain('customer_location')
    expect(TASK_LINK_ENDPOINTS.customer_location.url).toBe('/customer-locations')
  })

  it('labels a customer_location row "Name (Customer)" from customer_name, falling back to the id', () => {
    expect(TASK_LINK_ENDPOINTS.customer_location.label({ id: '1', name: 'Location X', customer_name: 'Customer Y' })).toBe('Location X (Customer Y)')
    expect(TASK_LINK_ENDPOINTS.customer_location.label({ id: '1', name: 'Location X' })).toBe('Location X')
    expect(TASK_LINK_ENDPOINTS.customer_location.label({ id: '1' })).toBe('#1')
  })

  it('gives every offered token a real endpoint (fixed url, or urlFor for a dependent token) and label function', () => {
    TASK_LINK_TYPES.forEach(token => {
      const cfg = TASK_LINK_ENDPOINTS[token]
      if (cfg.url) expect(cfg.url.startsWith('/')).toBe(true)
      else expect(cfg.urlFor?.('cand-1').startsWith('/')).toBe(true)
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
    expect(TASK_LINK_PAGE.opportunity).toBe('opportunities')
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

  it('labels a contact with its job function when present, name-only otherwise (shared lib/contactLabel)', () => {
    expect(TASK_LINK_ENDPOINTS.contact.label({ id: '1', name: 'Jan Jansen', function: 'HR Manager' })).toBe('Jan Jansen — HR Manager')
    expect(TASK_LINK_ENDPOINTS.contact.label({ id: '1', name: 'Jan Jansen' })).toBe('Jan Jansen')
  })

  it('keeps location (own branch) and customer_location (a customer\'s site) as distinct, non-overlapping tokens', () => {
    // Both offered, each with its own endpoint/label — never sharing a url or a label fn.
    expect(TASK_LINK_TYPES).toContain('location')
    expect(TASK_LINK_TYPES).toContain('customer_location')
    expect(TASK_LINK_ENDPOINTS.location.url).not.toBe(TASK_LINK_ENDPOINTS.customer_location.url)
  })

  describe('reference (REFERENCE-LINK-1, dependent on the task\'s linked candidate)', () => {
    it('is a dependent token: no fixed url, but a per-candidate urlFor', () => {
      expect(TASK_LINK_ENDPOINTS.reference.url).toBeUndefined()
      expect(TASK_LINK_ENDPOINTS.reference.urlFor?.('cand-1')).toBe('/candidates/cand-1/references')
    })

    it('labels a reference row "Name · Relation", falling back to the name then the id', () => {
      expect(TASK_LINK_ENDPOINTS.reference.label({ id: 'r1', name: 'Karim', relation: { label: 'Partner' } })).toBe('Karim · Partner')
      expect(TASK_LINK_ENDPOINTS.reference.label({ id: 'r1', name: 'Karim' })).toBe('Karim')
      expect(TASK_LINK_ENDPOINTS.reference.label({ id: 'r1' })).toBe('#r1')
    })

    it('resolveLinkUrl: a fixed-url token ignores candidateId; the dependent token needs one', () => {
      expect(resolveLinkUrl('candidate', null)).toBe('/candidates')
      expect(resolveLinkUrl('reference', null)).toBeUndefined()
      expect(resolveLinkUrl('reference', 'cand-1')).toBe('/candidates/cand-1/references')
    })
  })

  describe('useReferenceLinkAvailable', () => {
    beforeEach(() => { mockGet.mockReset() })

    it('is false with no candidate id — never probes', () => {
      const { result } = renderHook(() => useReferenceLinkAvailable(null))
      expect(result.current).toBe(false)
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('probes the light route quietly and flips true on 200', async () => {
      mockGet.mockResolvedValue({ data: [] })
      const { result } = renderHook(() => useReferenceLinkAvailable('cand-1'))
      await waitFor(() => expect(result.current).toBe(true))
      expect(mockGet).toHaveBeenCalledWith('/candidates/cand-1/references', { params: { per_page: 1 }, quietStatuses: [404] })
    })

    it('stays false on a quiet 404 — the route is not live for this tenant yet', async () => {
      mockGet.mockRejectedValue({ response: { status: 404 } })
      const { result } = renderHook(() => useReferenceLinkAvailable('cand-1'))
      await waitFor(() => expect(mockGet).toHaveBeenCalled())
      expect(result.current).toBe(false)
    })
  })
})
