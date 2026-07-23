/**
 * useShiftLookups — PLAN-LOOKUP-1 regression tests. `api` is mocked; react-query
 * needs a real QueryClientProvider (mirrors useShiftsChartData.test.tsx). Covers:
 * customer mapping (+ its own loading/error), the customer→department cascade
 * (via the real useCustomerDepartments — only its underlying api.get is mocked),
 * and the debounced candidate search (+ its name/function-title fallbacks).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useShiftCustomers, useShiftDepartments, useShiftCandidateSearch } from './useShiftLookups'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    return (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object))
      ? (body as { data: unknown }).data
      : body
  },
  unwrapList: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown })?.data) ? (body as { data: unknown[] }).data : []
    return { rows, total: rows.length, page: 1, lastPage: 1, perPage: rows.length }
  },
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const mockedGet = vi.mocked(api.get)
afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useShiftCustomers', () => {
  it('maps id/name (falling back to company_name) and reports success', async () => {
    mockedGet.mockResolvedValue({ data: { data: [
      { id: 'c1', name: 'Rivas Zorggroep' },
      { id: 'c2', company_name: 'Yesway Zorg' },
    ] } })
    const { result } = renderHook(() => useShiftCustomers(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.customers).toEqual([
      { id: 'c1', name: 'Rivas Zorggroep' },
      { id: 'c2', name: 'Yesway Zorg' },
    ])
  })

  it('reports the error state on a rejected request (no fabricated fallback list)', async () => {
    mockedGet.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useShiftCustomers(), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.customers).toEqual([])
  })
})

describe('useShiftDepartments', () => {
  it('is empty and not loading when no customer is picked', () => {
    const { result } = renderHook(() => useShiftDepartments(''), { wrapper })
    expect(result.current.departments).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('loads the picked customer\'s departments (flat — no Location step in this modal)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'd1', name: 'Watertorenlocatie' }] } })
    const { result } = renderHook(() => useShiftDepartments('cust1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    // The load is abortable since audit r4 — the GET carries an AbortSignal config.
    expect(mockedGet).toHaveBeenCalledWith('/customers/cust1/departments', expect.objectContaining({ signal: expect.anything() }))
    expect(result.current.departments).toEqual([{ id: 'd1', name: 'Watertorenlocatie' }])
  })
})

describe('useShiftCandidateSearch', () => {
  // The INITIAL query (e.g. '' on modal open) fetches right away — deliberate,
  // it's what lets the panel show a browsable list before the user types
  // anything. The debounce only guards CHANGES to the query (actual typing),
  // so this exercises a rerender with a new query, not the initial mount value.
  it('debounces a query change before hitting the API again', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { rerender } = renderHook(({ q }) => useShiftCandidateSearch(q), { wrapper, initialProps: { q: '' } })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    mockedGet.mockClear()

    rerender({ q: 'ism' })
    // Immediately after the query changes, the debounce hasn't fired yet.
    expect(mockedGet).not.toHaveBeenCalled()
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/candidates', { params: { search: 'ism', per_page: 50 }, signal: expect.anything() }))
  })

  it('falls back to first+last name and function_title/title when `name` is absent', async () => {
    mockedGet.mockResolvedValue({ data: { data: [
      { id: 'k1', first_name: 'Ismail', last_name: 'Eddahchouri', function_title: 'Verzorgende IG' },
      { id: 'k2', name: 'Merel Van Muijlwijk', title: 'Helpende' },
    ] } })
    const { result } = renderHook(() => useShiftCandidateSearch(''), { wrapper })
    await act(async () => { await new Promise(r => setTimeout(r, 320)) })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.candidates).toEqual([
      { id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'Verzorgende IG' },
      { id: 'k2', name: 'Merel Van Muijlwijk', functionTitle: 'Helpende' },
    ])
  })
})
