/**
 * The customer's Sollicitaties sub-tab must ask for THAT customer's applications
 * — mirrors useCustomerMatches.test.ts's own proof of the request shape. Here the
 * ARRAY form matters specifically: ApplicationQuery validates `customer_id` as an
 * array of uuids (measured in ApplicationQuery.php:82-83), unlike the scoped
 * vacancy/match filters' bare uuid — a plain scalar here would be the wrong
 * contract even though it might not 422 identically. This pins the actual
 * request, not just "a callback fired" (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCustomerApplications } from './useCustomerDrawerData'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } } as { data: { data: unknown[] } })) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useCustomerApplications', () => {
  it('sends customer_id as an ARRAY — the form ApplicationQuery actually validates', async () => {
    renderHook(() => useCustomerApplications('cust-1', []), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/applications')
    expect(config?.params).toMatchObject({ customer_id: ['cust-1'] })
  })

  it('never fires while no customerId is known yet (disabled query)', () => {
    renderHook(() => useCustomerApplications(undefined, []), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it("maps rows through the applications page's own mapApplication, not a fork", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [{
          id: 'app-1', candidate: { id: 'cand-1', name: 'Jane Doe' }, vacancy: { id: 'vac-1', title: 'Verpleegkundige' },
          customer_id: 'cust-1', phase_key: 'applied', score: 82, created_at: '2026-07-01',
        }],
      },
    })
    const { result } = renderHook(() => useCustomerApplications('cust-1', []), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    const row = result.current.rows[0]
    // The shared mapper's own fields resolve (proves reuse, not a fork).
    expect(row.candidateName).toBe('Jane Doe')
    expect(row.vacancyTitle).toBe('Verpleegkundige')
    expect(row.phaseKey).toBe('applied')
    expect(row.score).toBe(82)
  })
})
