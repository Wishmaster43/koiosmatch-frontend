/**
 * useOpportunitiesData — regression test for ARCHIVE-1 (2026-07-18): now that
 * OpportunityResource serializes archived/deleted_at and the controller's
 * include_archived flag is real, the hook must (a) only send ?include_archived=1
 * when asked and (b) actually refetch — not silently reuse the cached page —
 * when the flag flips (the query key carries it), so the toggle never looks
 * broken (mirrors the fake-toggle bug this sweep fixed).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOpportunitiesData } from './useOpportunitiesData'

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useOpportunityStages', () => ({
  useOpportunityStages: () => ({ stages: [], stageMeta: () => ({ value: '', label: '', color: '#9CA3AF' }) }),
}))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

import api from '@/lib/api'
const mockedGet = vi.mocked(api.get)

// react-query needs a client in the tree; retry:false keeps failed-fetch tests fast.
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Each test's own react-query cache is fresh, but the mocked api.get call log
// is module-level — reset it so `.mock.calls.find` never picks up a PRIOR test's call.
afterEach(() => vi.clearAllMocks())

describe('useOpportunitiesData · ARCHIVE-1', () => {
  it('fetches the default (active-only) list with no include_archived param', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toBeUndefined()
  })

  it('sends include_archived: 1 (numeric, not a JS boolean) when the toggle is on', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toEqual({ include_archived: 1 })
  })

  it('maps archived + deleted_at rows through so the table can chip them', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/opportunities') {
        return Promise.resolve({ data: { data: [
          { id: 'o1', title: 'Deal A', archived: true, deleted_at: '2026-07-10T00:00:00Z' },
        ] } })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    const { result } = renderHook(() => useOpportunitiesData(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ archived: true, archivedAt: '2026-07-10T00:00:00Z' })
  })
})
