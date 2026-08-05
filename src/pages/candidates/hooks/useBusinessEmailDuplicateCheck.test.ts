/**
 * useBusinessEmailDuplicateCheck — request-shape tests (§13: assert the REQUEST,
 * never just that a callback fired). Covers the exact route/params, self-exclusion,
 * and the best-effort failure path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBusinessEmailDuplicateCheck } from './useBusinessEmailDuplicateCheck'

const getMock = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
  unwrapList: (res: { data: { data: unknown[] } }) => ({ rows: res.data.data }),
}))

describe('useBusinessEmailDuplicateCheck', () => {
  beforeEach(() => { getMock.mockReset() })

  it('fires GET /candidates with the search param, never the check-duplicate probe', async () => {
    getMock.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    await result.current.checkDuplicate('piet@example.com')
    expect(getMock).toHaveBeenCalledWith('/candidates', { params: { search: 'piet@example.com', per_page: 5 } })
  })

  it('returns the OTHER candidate as a match, excluding the current id (no server exclude param exists)', async () => {
    getMock.mockResolvedValue({ data: { data: [
      { id: 'cand-1', name: 'Self', archived: false },
      { id: 'cand-2', name: 'Piet Freelancer', archived: false },
    ] } })
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    const dup = await result.current.checkDuplicate('piet@example.com')
    expect(dup).toEqual({ id: 'cand-2', name: 'Piet Freelancer', archived: false })
  })

  it('returns null when the only hit is the candidate itself', async () => {
    getMock.mockResolvedValue({ data: { data: [{ id: 'cand-1', name: 'Self', archived: false }] } })
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    const dup = await result.current.checkDuplicate('self@example.com')
    expect(dup).toBeNull()
  })

  it('returns null on a failed probe rather than blocking the caller (best-effort)', async () => {
    getMock.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    const dup = await result.current.checkDuplicate('piet@example.com')
    expect(dup).toBeNull()
  })
})
