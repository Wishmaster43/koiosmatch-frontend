/**
 * useVacancyLite — proves the light fetch resolves the title/initials from the
 * raw vacancy response (no mapVacancyDetail dependency), degrades to the error
 * state on a failed GET, and stays disabled (never calls the API) without an id.
 * Mirrors useCandidateLite.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useVacancyLite } from './useVacancyLite'

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

describe('useVacancyLite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves the title as name + initials from the raw vacancy response', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 'vac-1', title: 'Verzorgende IG' } } })
    const { result } = renderHook(() => useVacancyLite('vac-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(apiGet).toHaveBeenCalledWith('/vacancies/vac-1', expect.objectContaining({}))
    expect(result.current.vacancy).toEqual({ id: 'vac-1', name: 'Verzorgende IG', initials: 'VI' })
    expect(result.current.error).toBe(false)
  })

  it('surfaces an error state (never a crash) when the GET fails', async () => {
    apiGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useVacancyLite('vac-2'), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.vacancy).toBeNull()
  })

  it('never calls the API without an id', () => {
    const { result } = renderHook(() => useVacancyLite(undefined), { wrapper })
    expect(apiGet).not.toHaveBeenCalled()
    expect(result.current.vacancy).toBeNull()
  })
})
