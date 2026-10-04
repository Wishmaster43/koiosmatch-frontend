/**
 * useResolveContractClaim — pins the CLAIM-RESOLVE-1 request shape: the per-
 * match resolve route, the `{ reason }` body, and a per-click Idempotency-Key
 * header (§13 — asserts the request, never only that a callback fired).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResolveContractClaim } from './useResolveContractClaim'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn() } }
})

import api from '@/lib/api'
const post = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { post.mockReset() })

describe('useResolveContractClaim', () => {
  it('POSTs /matches/{id}/contract/resolve with the reason body and an Idempotency-Key', async () => {
    post.mockResolvedValue({ data: { contract_status: 'failed', resolved: true } })
    const { result } = renderHook(() => useResolveContractClaim('m1'))
    await act(async () => { await result.current.resolve('Klant belde dat het nooit aangekomen is') })
    expect(post).toHaveBeenCalledWith('/matches/m1/contract/resolve',
      { reason: 'Klant belde dat het nooit aangekomen is' },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  })

  it('returns the 200 body on success', async () => {
    post.mockResolvedValue({ data: { contract_status: 'failed', resolved: true } })
    const { result } = renderHook(() => useResolveContractClaim('m1'))
    let body: unknown
    await act(async () => { body = await result.current.resolve('reason') })
    expect(body).toEqual({ contract_status: 'failed', resolved: true })
  })

  it('rethrows on failure (the caller maps the 409 code), never swallowing the error', async () => {
    post.mockRejectedValue({ response: { status: 409, data: { code: 'contract_already_sent' } } })
    const { result } = renderHook(() => useResolveContractClaim('m1'))
    await expect(act(async () => { await result.current.resolve('reason') })).rejects.toBeTruthy()
  })
})
