/**
 * useCandidateLite — proves the light fetch resolves name/initials/summary from
 * the raw candidate response (no mapCandidate dependency), degrades to the error
 * state on a failed GET, and stays disabled (never calls the API) without an id.
 *
 * Shape change 09-08: `summary` joined CandidateLite for the profile-text popout
 * (TEKST-POPOUT-1, CandidateSummaryPopout reads `candidate.summary`). The exact-
 * shape assertion below is kept exact ON PURPOSE — it is what caught the field
 * arriving — and now also pins its fallback chain, so a silently dropped or
 * renamed summary still fails here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCandidateLite } from './useCandidateLite'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCandidateLite', () => {
  beforeEach(() => vi.clearAllMocks())

  // The summary is absent from this response, so it must settle on the empty
  // string — never `undefined`, which would make the summary popout's editor
  // switch between uncontrolled and controlled.
  it('resolves name + initials + summary from the raw candidate response', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 'c1', first_name: 'Anne', last_name: 'de Vries' } } })
    const { result } = renderHook(() => useCandidateLite('c1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(apiGet).toHaveBeenCalledWith('/candidates/c1', expect.objectContaining({}))
    expect(result.current.candidate).toEqual({ id: 'c1', name: 'Anne de Vries', initials: 'AD', summary: '' })
    expect(result.current.error).toBe(false)
  })

  // Same summary → bio → '' chain mapCandidate uses; the popout must not invent
  // a value when the record carries only the legacy `bio` field.
  it('falls back through the summary chain to the legacy bio field', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 'c4', full_name: 'Cor Smit', summary: null, bio: 'Wijkverpleegkundige' } } })
    const { result } = renderHook(() => useCandidateLite('c4'), { wrapper })
    await waitFor(() => expect(result.current.candidate?.summary).toBe('Wijkverpleegkundige'))
  })

  it('falls back through the name chain to the bare full_name field', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 'c2', full_name: 'Bram Jansen' } } })
    const { result } = renderHook(() => useCandidateLite('c2'), { wrapper })
    await waitFor(() => expect(result.current.candidate?.name).toBe('Bram Jansen'))
  })

  it('surfaces an error state (never a crash) when the GET fails', async () => {
    apiGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCandidateLite('c3'), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.candidate).toBeNull()
  })

  it('never calls the API without an id', () => {
    const { result } = renderHook(() => useCandidateLite(undefined), { wrapper })
    expect(apiGet).not.toHaveBeenCalled()
    expect(result.current.candidate).toBeNull()
  })
})
