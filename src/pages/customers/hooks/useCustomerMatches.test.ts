/**
 * The customer's Matches tab must ask for THAT customer's matches — mirrors
 * useCustomerVacancies.filter.test.ts's own proof that the request carries
 * customer_id (a wrong-but-accepted filter name is invisible in a way a 422
 * never is, so the request shape itself is what this pins, not just "a
 * callback fired", §13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCustomerMatches } from './useCustomerDrawerData'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } } as { data: { data: unknown[] } } )) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useCustomerMatches', () => {
  it('filters on customer_id — the parameter MatchController actually reads', async () => {
    renderHook(() => useCustomerMatches('cust-1'), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/matches')
    expect(config?.params).toMatchObject({ customer_id: 'cust-1' })
  })

  it('never fires while no customerId is known yet (disabled query)', () => {
    renderHook(() => useCustomerMatches(undefined), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('maps contract_type/contract_status off the raw row alongside the shared mapMatch output', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{
        id: 'm-1', candidate: { id: 'cand-1', name: 'Jane Doe' }, vacancy: { id: 'vac-1', title: 'Verpleegkundige' },
        customer_id: 'cust-1', contract_type: 'Fase 1-2', contract_status: 'active', status: 'open', match_score: 80,
      }] },
    })
    const { result } = renderHook(() => useCustomerMatches('cust-1'), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    const row = result.current.rows[0]
    // The shared mapper's own fields still resolve (proves reuse, not a fork).
    expect(row.candidate).toBe('Jane Doe')
    expect(row.candidateId).toBe('cand-1')
    expect(row.vacancy).toBe('Verpleegkundige')
    // The two extra fields the shared MatchRow shape doesn't carry.
    expect(row.contractType).toBe('Fase 1-2')
    expect(row.contractStatus).toBe('active')
  })
})
