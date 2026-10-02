/**
 * useContactErase — asserts the exact POST route and body (§13: a mutation test
 * proves the request, never only that a callback fired) and that the hand-written
 * 200 shape unwraps correctly.
 */
import { describe, it, expect, vi } from 'vitest'
import api from '@/lib/api'
import { eraseContact } from './useContactErase'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { ...(actual as { default: object }).default, post: vi.fn() } }
})

describe('eraseContact', () => {
  it('POSTs /customers/{customer}/contacts/{contact}/erase with exactly { password }', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { message: 'ok', contact_id: 'k1' } } })

    const res = await eraseContact('cust-1', 'k1', 'geheim')

    expect(api.post).toHaveBeenCalledWith('/customers/cust-1/contacts/k1/erase', { password: 'geheim' })
    expect(res).toEqual({ message: 'ok', contact_id: 'k1' })
  })

  it('propagates a rejected request untouched (the dialog maps the status)', async () => {
    const failure = { response: { status: 403 } }
    vi.mocked(api.post).mockRejectedValue(failure)

    await expect(eraseContact('cust-1', 'k1', 'wrong')).rejects.toBe(failure)
  })
})
