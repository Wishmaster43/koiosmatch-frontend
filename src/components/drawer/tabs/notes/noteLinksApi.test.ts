/**
 * noteLinksApi — request pins: exact method/URL/body for both hosts, and the
 * honest true/false resolution on add/remove (mirrors linkedNoteApi.test.ts's idiom).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import { addNoteLink, removeNoteLink } from './noteLinksApi'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { post: vi.fn(), delete: vi.fn() } }
})

beforeEach(() => vi.clearAllMocks())

describe('addNoteLink', () => {
  it('POSTs the candidate host route with the exact body and resolves the created link', async () => {
    const created = { id: 'l1', linkable_type: 'customer', linkable_id: 'cu1', label: 'Acme B.V.', is_manual: true }
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: created } } as never)
    const link = await addNoteLink('candidates', 'c1', 'n1', { linkable_type: 'customer', linkable_id: 'cu1' })
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/notes/n1/links', { linkable_type: 'customer', linkable_id: 'cu1' })
    expect(link).toEqual(created)
  })

  it('POSTs the customer host route', async () => {
    const created = { id: 'l2', linkable_type: 'candidate', linkable_id: 'ca1', label: 'Ahmed Bakker', is_manual: true }
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: created } } as never)
    await addNoteLink('customers', 'cu1', 'n2', { linkable_type: 'candidate', linkable_id: 'ca1' })
    expect(api.post).toHaveBeenCalledWith('/customers/cu1/notes/n2/links', { linkable_type: 'candidate', linkable_id: 'ca1' })
  })

  it('a null label (no view rights on the principal domain) round-trips as null, never dropped', async () => {
    const created = { id: 'l3', linkable_type: 'location', linkable_id: 'lo1', label: null, is_manual: true }
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: created } } as never)
    const link = await addNoteLink('candidates', 'c1', 'n1', { linkable_type: 'location', linkable_id: 'lo1' })
    expect(link.label).toBeNull()
  })
})

describe('removeNoteLink', () => {
  it('DELETEs the exact candidate host route and resolves true on 2xx', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: null } as never)
    const ok = await removeNoteLink('candidates', 'c1', 'n1', 'l1')
    expect(api.delete).toHaveBeenCalledWith('/candidates/c1/notes/n1/links/l1')
    expect(ok).toBe(true)
  })

  it('DELETEs the exact customer host route', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: null } as never)
    await removeNoteLink('customers', 'cu1', 'n2', 'l2')
    expect(api.delete).toHaveBeenCalledWith('/customers/cu1/notes/n2/links/l2')
  })

  it('rejects (never resolves true) when the backend refuses an auto-derived link (404)', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { status: 404 } })
    await expect(removeNoteLink('candidates', 'c1', 'n1', 'auto1')).rejects.toBeTruthy()
  })
})
