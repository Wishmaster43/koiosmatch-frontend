/**
 * useSmLocations — the empty list is a STABLE reference while loading. A fresh [] per
 * render re-fed LocationsPage's filterGroups memo, whose registerFilters effect updated the
 * right-panel context, which re-rendered the page: "Maximum update depth exceeded"
 * (measured on #shiftmanager.locations-table, 03-09).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSmLocations } from './useSmLocations'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => new Promise(() => {})) } }
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useSmLocations', () => {
  it('returns the same empty list reference across renders while the request is pending', () => {
    const { result, rerender } = renderHook(() => useSmLocations(), { wrapper })
    const first = result.current.locations
    rerender()
    expect(result.current.locations).toBe(first)
    expect(first).toEqual([])
  })
})
