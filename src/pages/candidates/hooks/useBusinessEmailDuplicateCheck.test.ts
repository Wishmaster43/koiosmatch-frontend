/**
 * useBusinessEmailDuplicateCheck — request-shape tests (§13: assert the REQUEST,
 * never just that a callback fired). audit privacy-1: the e-mail travels in the
 * POST body of /candidates/check-duplicate (CMBE c5958192: `business_email`), never
 * as a GET query parameter. Covers the exact route/body, self-exclusion, the
 * no-match answer and the best-effort failure path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBusinessEmailDuplicateCheck } from './useBusinessEmailDuplicateCheck'

const postMock = vi.fn()
const getMock = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => postMock(...args), get: (...args: unknown[]) => getMock(...args) },
}))

describe('useBusinessEmailDuplicateCheck', () => {
  beforeEach(() => { postMock.mockReset(); getMock.mockReset() })

  it('POSTs the e-mail in the body of /candidates/check-duplicate and never fires a GET with it', async () => {
    postMock.mockResolvedValue({ data: { exists: false, match: null } })
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    await result.current.checkDuplicate('piet@example.com')
    expect(postMock).toHaveBeenCalledWith('/candidates/check-duplicate', { business_email: 'piet@example.com' })
    expect(getMock).not.toHaveBeenCalled()
  })

  it('returns the OTHER candidate as a match', async () => {
    postMock.mockResolvedValue({ data: { exists: true, match: { id: 'cand-2', name: 'Piet Freelancer', archived: false } } })
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    expect(await result.current.checkDuplicate('piet@example.com')).toEqual({ id: 'cand-2', name: 'Piet Freelancer', archived: false })
  })

  it('returns null when the match is the candidate itself', async () => {
    postMock.mockResolvedValue({ data: { exists: true, match: { id: 'cand-1', name: 'Self', archived: false } } })
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    expect(await result.current.checkDuplicate('piet@example.com')).toBeNull()
  })

  it('returns null when nothing exists', async () => {
    postMock.mockResolvedValue({ data: { exists: false, match: null } })
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    expect(await result.current.checkDuplicate('piet@example.com')).toBeNull()
  })

  it('returns null on a failed probe rather than blocking the caller (best-effort)', async () => {
    postMock.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useBusinessEmailDuplicateCheck('cand-1'))
    expect(await result.current.checkDuplicate('piet@example.com')).toBeNull()
  })
})
