/**
 * X-38 (AFSPRAKEN-PLEK-1): the customer Afspraken tab must hit GET /appointments with
 * the server-side customer filter + pagination params, never pull the tenant list to
 * filter client-side (§8) — the REQUEST is what this pins (§13), mirroring
 * useVacancyAppointments.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCustomerAppointments, CUSTOMER_APPOINTMENTS_PER_PAGE } from './useCustomerAppointments'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [], meta: { total: 0, current_page: 1, last_page: 1, per_page: 20 } } })) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useCustomerAppointments', () => {
  it('GETs /appointments with the customer_id filter and page/per_page params', async () => {
    renderHook(() => useCustomerAppointments('cust-1', 2), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/appointments')
    expect(config?.params).toEqual({ customer_id: 'cust-1', page: 2, per_page: CUSTOMER_APPOINTMENTS_PER_PAGE })
  })

  it('maps the AppointmentResource rows and forwards the pagination meta', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: {
      data: [{ id: 'a1', scheduled_at: '2026-09-10T09:00:00', duration_min: 30, type: 'intake', status: 'planned', modality: 'on_site',
        candidate_id: 'c1', candidate_name: 'Jane Doe', owner: { id: 'u1', name: 'Rick' }, customer_id: 'cust-1' }],
      meta: { total: 41, current_page: 1, last_page: 3, per_page: 20 },
    } })
    const { result } = renderHook(() => useCustomerAppointments('cust-1'), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.rows[0].candidateName).toBe('Jane Doe')
    expect(result.current.total).toBe(41)
    expect(result.current.lastPage).toBe(3)
  })

  it('never fires without a customer id', async () => {
    const { result } = renderHook(() => useCustomerAppointments(undefined), { wrapper })
    await new Promise(r => setTimeout(r, 30))
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.rows).toEqual([])
  })
})
