/**
 * useLocations · every branch page is loaded (ONIX N-010 sibling): LocationController
 * pages at 50 and caps at 100, so the picker must request 100 and follow page 2.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { useLocations } from './useLocations'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>

describe('useLocations · pagination', () => {
  it('sends per_page=100 and merges the second page', async () => {
    vi.mocked(api.get).mockImplementation(((_u: string, c: { params?: { page?: number } }) => {
      const page = c?.params?.page ?? 1
      return Promise.resolve({ data: { data: [{ id: page, name: `B${page}` }], meta: { total: 2, current_page: page, last_page: 2, per_page: 100 } } })
    }) as never)
    const { result } = renderHook(() => useLocations(), { wrapper })
    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current.map(o => o.label)).toEqual(['B1', 'B2'])
    expect(vi.mocked(api.get).mock.calls[0][1]).toMatchObject({ params: { per_page: 100 } })
  })
})
