/**
 * useCandidateRecord.patchCandidate — BUG CLASS FIX regression coverage. This
 * used to fire the PATCH and, on failure, only toast — any optimistic write the
 * caller already applied (list row + open drawer) stayed showing the value the
 * server rejected. `patchCandidate` now accepts an optional `revert` callback the
 * caller supplies to restore its own snapshot; these tests assert the SEAM (§13):
 * the exact request, that `revert` fires only on failure with the SERVER's
 * message surfaced, and never on success (or when no revert is supplied at all —
 * existing callers must keep compiling and behaving as before). REFRESH-FIX-2:
 * a successful PATCH also reconciles the candidates + applications caches — the
 * candidate drawer's own save site is the third adoption site of that fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useCandidateRecord } from './useCandidateMutations'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { patch: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// The hook now reads useQueryClient() to invalidate on save (REFRESH-FIX-2) —
// every renderHook needs a provider; `client` is exposed so a test can spy on
// invalidateQueries directly.
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children)

describe('useCandidateRecord · patchCandidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it('PATCHes only the mapped fields', () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useCandidateRecord(), { wrapper })
    result.current.patchCandidate('c1', { ownerId: 'u2' })
    expect(apiPatch).toHaveBeenCalledWith('/candidates/c1', { owner_id: 'u2' })
  })

  it('never calls revert or notifyError when the request succeeds', async () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const revert = vi.fn()
    const { result } = renderHook(() => useCandidateRecord(), { wrapper })
    result.current.patchCandidate('c1', { ownerId: 'u2' }, revert)
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(revert).not.toHaveBeenCalled()
    expect(notifyError).not.toHaveBeenCalled()
  })

  // REFRESH-FIX-2: the candidate-drawer save site — a candidate edited HERE must
  // reconcile the applications cache too, since application rows denormalise the
  // candidate's joined name/function.
  it('invalidates the candidates and applications caches on a successful save', async () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCandidateRecord(), { wrapper })
    await result.current.patchCandidate('c1', { ownerId: 'u2' })
    // One predicate-scoped call (candidates + applications, never their stats
    // branches — the exact scope is pinned in lib/invalidateEntity.test.ts).
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    const predicate = (invalidateSpy.mock.calls[0][0] as unknown as { predicate: (q: { queryKey: unknown[] }) => boolean }).predicate
    expect(predicate({ queryKey: ['candidates', 'x'] })).toBe(true)
    expect(predicate({ queryKey: ['applications', 'stats', {}] })).toBe(false)
  })

  // A failed save must never reconcile caches with a value the server rejected.
  it('never invalidates when the PATCH fails', async () => {
    apiPatch.mockRejectedValue({ response: { data: {} } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCandidateRecord(), { wrapper })
    await result.current.patchCandidate('c1', { ownerId: 'gone' })
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('calls the caller-supplied revert and surfaces the SERVER message on failure', async () => {
    apiPatch.mockRejectedValue({ response: { data: { message: 'Eigenaar bestaat niet meer' } } })
    const revert = vi.fn()
    const { result } = renderHook(() => useCandidateRecord(), { wrapper })
    result.current.patchCandidate('c1', { ownerId: 'gone' }, revert)
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(revert).toHaveBeenCalledTimes(1)
    expect(notifyError).toHaveBeenCalledWith('Eigenaar bestaat niet meer')
  })

  it('still surfaces a fallback message and never throws when no revert is supplied (existing callers)', async () => {
    apiPatch.mockRejectedValue({ response: { data: {} } })
    const { result } = renderHook(() => useCandidateRecord(), { wrapper })
    expect(() => result.current.patchCandidate('c1', { ownerId: 'gone' })).not.toThrow()
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
  })
})
