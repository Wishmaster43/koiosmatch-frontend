/**
 * CUSTOMER-PRELOAD-1 (16-10): the vacancies page preloads the customer pickers through the
 * shared fetchAllPages helper at the /customers server cap (100, ONIX N-010), so a bureau with
 * more than one page of customers never silently loses the rest. Asserts the REQUESTS (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useVacanciesData } from './useVacanciesData'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)
const t = ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t']
const customerCalls = () => vi.mocked(api.get).mock.calls.filter(([url]) => url === '/customers')

describe('useVacanciesData · customer preload pages through the server cap', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('asks /customers at per_page 100 and walks to page 2 when the server reports two pages', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === '/customers') {
        const page = Number((config?.params as Record<string, unknown> | undefined)?.page ?? 1)
        return page === 1
          ? { data: { data: [{ id: 'c1', name: 'Alpha' }], meta: { total: 2, current_page: 1, last_page: 2, per_page: 100 } } }
          : { data: { data: [{ id: 'c2', company_name: 'Beta' }], meta: { total: 2, current_page: 2, last_page: 2, per_page: 100 } } }
      }
      return { data: { data: [] } }
    })
    const { result } = renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t, sort: null }), { wrapper })
    await waitFor(() => expect(customerCalls().length).toBe(2))
    expect(customerCalls()[0][1]).toMatchObject({ params: { per_page: 100 } })
    expect(customerCalls()[1][1]).toMatchObject({ params: { per_page: 100, page: 2 } })
    await waitFor(() => expect(result.current.customers).toEqual([{ id: 'c1', name: 'Alpha' }, { id: 'c2', name: 'Beta' }]))
  })

  it('stops after page 1 when the server reports a single page', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url === '/customers'
        ? { data: { data: [{ id: 'c1', name: 'Alpha' }], meta: { total: 1, current_page: 1, last_page: 1, per_page: 100 } } }
        : { data: { data: [] } })
    const { result } = renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t, sort: null }), { wrapper })
    await waitFor(() => expect(result.current.customers).toEqual([{ id: 'c1', name: 'Alpha' }]))
    expect(customerCalls().length).toBe(1)
  })
})
