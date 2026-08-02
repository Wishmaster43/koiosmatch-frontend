/**
 * The customer's Vacatures tab must ask for THAT customer's vacancies.
 *
 * It sent `client_id` until 02-08 and listed every vacancy of the bureau. VacancyQuery has no
 * such filter, and an unknown filter is ignored rather than rejected — so the request looked
 * fine and the data was wrong. That is the failure this pins: a wrong-but-accepted parameter
 * name is invisible in a way a 422 never is.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCustomerVacancies } from './useCustomerDrawerData'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useCustomerVacancies', () => {
  it('filters on customer_id — the parameter VacancyQuery actually reads', async () => {
    renderHook(() => useCustomerVacancies('cust-1'), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/vacancies')
    expect(config?.params).toMatchObject({ customer_id: 'cust-1' })
    // The old name is not a filter the backend knows, so sending it matched everything.
    expect(config?.params).not.toHaveProperty('client_id')
  })
})
