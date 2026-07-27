/**
 * useCandidateRecord.patchCandidate — BUG CLASS FIX regression coverage. This
 * used to fire the PATCH and, on failure, only toast — any optimistic write the
 * caller already applied (list row + open drawer) stayed showing the value the
 * server rejected. `patchCandidate` now accepts an optional `revert` callback the
 * caller supplies to restore its own snapshot; these tests assert the SEAM (§13):
 * the exact request, that `revert` fires only on failure with the SERVER's
 * message surfaced, and never on success (or when no revert is supplied at all —
 * existing callers must keep compiling and behaving as before).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCandidateRecord } from './useCandidateMutations'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { patch: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

describe('useCandidateRecord · patchCandidate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('PATCHes only the mapped fields', () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useCandidateRecord())
    result.current.patchCandidate('c1', { ownerId: 'u2' })
    expect(apiPatch).toHaveBeenCalledWith('/candidates/c1', { owner_id: 'u2' })
  })

  it('never calls revert or notifyError when the request succeeds', async () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const revert = vi.fn()
    const { result } = renderHook(() => useCandidateRecord())
    result.current.patchCandidate('c1', { ownerId: 'u2' }, revert)
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(revert).not.toHaveBeenCalled()
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('calls the caller-supplied revert and surfaces the SERVER message on failure', async () => {
    apiPatch.mockRejectedValue({ response: { data: { message: 'Eigenaar bestaat niet meer' } } })
    const revert = vi.fn()
    const { result } = renderHook(() => useCandidateRecord())
    result.current.patchCandidate('c1', { ownerId: 'gone' }, revert)
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(revert).toHaveBeenCalledTimes(1)
    expect(notifyError).toHaveBeenCalledWith('Eigenaar bestaat niet meer')
  })

  it('still surfaces a fallback message and never throws when no revert is supplied (existing callers)', async () => {
    apiPatch.mockRejectedValue({ response: { data: {} } })
    const { result } = renderHook(() => useCandidateRecord())
    expect(() => result.current.patchCandidate('c1', { ownerId: 'gone' })).not.toThrow()
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
  })
})
