/**
 * useSmCandidatesList — the empty list is a STABLE reference while loading. A fresh []
 * per render re-fed CandidatesDetailPage's filterGroups memo, whose registerFilters
 * effect updated the right-panel context, which re-rendered the page: an effect-driven
 * render loop (a vitest worker at 90% CPU for 18 minutes, measured 05-09; same class
 * as useSmLocations on 03-09).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSmCandidatesList } from './useSmCandidatesList'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => new Promise(() => {})), put: vi.fn() } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ refreshUser: vi.fn() }) }))
vi.mock('@/lib/usePageSize', () => ({ useDefaultPageSize: () => 25 }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useSmCandidatesList', () => {
  it('returns the same empty list reference across renders while the request is pending', () => {
    const { result, rerender } = renderHook(() => useSmCandidatesList(), { wrapper })
    const first = result.current.candidates
    rerender()
    expect(result.current.candidates).toBe(first)
    expect(first).toEqual([])
  })
})
