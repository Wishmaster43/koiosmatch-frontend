/**
 * useVacanciesData · column sort (item 4, DATATABLE-SORT-1 reference adoption)
 * — pins the REQUEST shape (§13: assert the request, not just that a callback
 * fired) for the FE-column-keyed `sort` param this hook now accepts:
 *   - a mapped column (createdAt/applications) adds sort_by/sort_dir to the
 *     /vacancies list request;
 *   - the request never carries BOTH the new sort_by/sort_dir pair and the OLD
 *     `sort=status` param at once (they are two separate, independently-wired
 *     mechanisms — this test proves the new one never touches the old one);
 *   - no sort at all reproduces the exact pre-adoption request shape (no
 *     sort_by/sort_dir keys).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useVacanciesData, vacancySortParams } from './useVacanciesData'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
})

function listParams() {
  const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/vacancies')
  return call?.[1]?.params as Record<string, unknown> | undefined
}

describe('vacancySortParams — pure translation', () => {
  it('maps createdAt/applications to their backend sort_by field', () => {
    expect(vacancySortParams({ by: 'createdAt', dir: 'desc' })).toEqual({ sort_by: 'created_at', sort_dir: 'desc' })
    expect(vacancySortParams({ by: 'applications', dir: 'asc' })).toEqual({ sort_by: 'applications_count', sort_dir: 'asc' })
  })
  it('an unmapped column (e.g. title) never becomes a request param', () => {
    expect(vacancySortParams({ by: 'title', dir: 'asc' })).toEqual({})
  })
  it('no sort → no params at all', () => {
    expect(vacancySortParams(null)).toEqual({})
    expect(vacancySortParams(undefined)).toEqual({})
  })
})

describe('useVacanciesData · sort wired into the /vacancies request', () => {
  it('unsorted default: no sort_by/sort_dir on the request (byte-identical to before this change)', async () => {
    renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t: ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t'], sort: null }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(listParams()).not.toHaveProperty('sort_by')
    expect(listParams()).not.toHaveProperty('sort_dir')
  })

  it('a mapped column sends sort_by/sort_dir on the list request', async () => {
    renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t: ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t'], sort: { by: 'createdAt', dir: 'desc' } }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(listParams()).toMatchObject({ sort_by: 'created_at', sort_dir: 'desc' })
  })

  it('the new sort_by/sort_dir pair never collides with the OLD status sort param', async () => {
    renderHook(() => useVacanciesData({ filterParams: { sort: 'status' }, page: 1, pageSize: 25, t: ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t'], sort: { by: 'applications', dir: 'asc' } }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    // Both survive, independently — the old param is untouched by the new mechanism.
    expect(listParams()).toMatchObject({ sort: 'status', sort_by: 'applications_count', sort_dir: 'asc' })
  })
})

// STATS-SCOPE-1 (2026-08-22 audit): the stats request must carry ONLY the view-scope
// subset of filterParams — never a dimension/attention filter — while the LIST request
// keeps receiving the full filterParams unchanged (§3B: KPI totals are server-wide).
describe('useVacanciesData · stats stays server-wide (STATS-SCOPE-1)', () => {
  const t = ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t']

  function statsParamsSent() {
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/vacancies/stats')
    return call?.[1]?.params as Record<string, unknown> | undefined
  }

  it('a dimension/attention filter (status/closing_soon) reaches the list but NOT the stats request', async () => {
    const filterParams = { status: ['open'], closing_soon: 1, owner_id: ['u1'] }
    renderHook(() => useVacanciesData({ filterParams, page: 1, pageSize: 25, t, sort: null }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies', expect.anything()))
    expect(listParams()).toMatchObject({ status: ['open'], closing_soon: 1, owner_id: ['u1'] })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({})
  })

  it('the archived view-scope flag reaches the stats request too', async () => {
    const filterParams = { include_archived: 1, category: ['nurse'] }
    renderHook(() => useVacanciesData({ filterParams, page: 1, pageSize: 25, t, sort: null }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({ include_archived: 1 })
  })

  it('changing only a dimension filter never re-fires the stats request (stable statsParams key)', async () => {
    const { rerender } = renderHook(
      ({ filterParams }) => useVacanciesData({ filterParams, page: 1, pageSize: 25, t, sort: null }),
      { wrapper, initialProps: { filterParams: { status: ['open'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies/stats', expect.anything()))
    const listCallsBefore  = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies').length
    const statsCallsBefore = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies/stats').length

    rerender({ filterParams: { status: ['closed'] } })
    await waitFor(() => {
      const listCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies').length
      expect(listCallsAfter).toBeGreaterThan(listCallsBefore)
    })
    const statsCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies/stats').length
    expect(statsCallsAfter).toBe(statsCallsBefore) // stats did not refetch — statsParams stayed {} both times
  })
})
