/**
 * useCandidatesData · KAND-FILTERS-1 — the "Voorkeuren" filter params
 * (contract_types[] / hours_per_week_min / hours_per_week_max /
 * available_from_before) reach the /candidates GET request exactly as
 * CandidatesPage merges them into filterParams. The hook is a plain
 * pass-through of that object (§13: assert the REQUEST, not just that a
 * callback fired) — this pins that no key gets dropped, renamed or coerced
 * on the way to the server, AND-combined with the existing pagination params.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCandidatesData } from './useCandidatesData'

// heavyGet (candidates/stats) is the shared guarded-GET wrapper (dedup + cooldown,
// module-level state) — stub it directly so its state never leaks between tests.
const heavyGetMock = vi.fn()
vi.mock('@/lib/heavyGet', () => ({ heavyGet: (...args: unknown[]) => heavyGetMock(...args) }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const t = ((k: string) => k) as unknown as import('i18next').TFunction

afterEach(() => vi.clearAllMocks())

describe('useCandidatesData · KAND-FILTERS-1 params reach the GET request', () => {
  it('forwards contract_types[]/hours_per_week_min/max/available_from_before untouched, AND-combined with pagination', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    const filterParams = {
      contract_types: ['freelance', 'payroll'],
      hours_per_week_min: 16,
      hours_per_week_max: 32,
      available_from_before: '2026-09-01',
    }
    renderHook(() => useCandidatesData({ filterParams, page: 2, pageSize: 25, t, setActionMsg: vi.fn() }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
    const params = call?.[1]?.params as Record<string, unknown> | undefined

    expect(params?.contract_types).toEqual(['freelance', 'payroll'])
    expect(params?.hours_per_week_min).toBe(16)
    expect(params?.hours_per_week_max).toBe(32)
    expect(params?.available_from_before).toBe('2026-09-01')
    // AND-combined: pagination params still ride along unchanged.
    expect(params?.page).toBe(2)
    expect(params?.per_page).toBe(25)
  })

  it('omits the Voorkeuren keys entirely when the filter is unset (never sends empty/0)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    renderHook(() => useCandidatesData({ filterParams: {}, page: 1, pageSize: 25, t, setActionMsg: vi.fn() }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
    const params = call?.[1]?.params as Record<string, unknown> | undefined

    expect(params).not.toHaveProperty('contract_types')
    expect(params).not.toHaveProperty('hours_per_week_min')
    expect(params).not.toHaveProperty('hours_per_week_max')
    expect(params).not.toHaveProperty('available_from_before')
  })
})

// CAND-SORT-1 (DATATABLE-SORT-1 reference adoption, mirrors useApplicationsData.test.ts):
// pins the REQUEST shape (§13: assert the request, not just that a callback fired) for
// the FE-column-keyed `sort` param — verified against the LIVE CandidateQuery::rules()
// whitelist (sort_by in:last_name,first_name,created_at,updated_at,last_contact_at,
// 2026-08-08: opposite sort_dir on last_name/created_at/last_contact_at each returned a
// different first row; an unlisted sort_by 422s).
describe('useCandidatesData · sort request shape (CAND-SORT-1)', () => {
  it('unsorted default: no sort_by/sort_dir on the request (byte-identical to before this change)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    renderHook(() => useCandidatesData({ filterParams: {}, page: 1, pageSize: 25, t, setActionMsg: vi.fn(), sort: null }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
    const params = call?.[1]?.params as Record<string, unknown> | undefined
    expect(params).not.toHaveProperty('sort_by')
    expect(params).not.toHaveProperty('sort_dir')
  })

  it('a column mapped to a real backend field sends sort_by/sort_dir on the list request', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    renderHook(() => useCandidatesData({
      filterParams: {}, page: 1, pageSize: 25, t, setActionMsg: vi.fn(), sort: { by: 'created', dir: 'desc' },
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
    const params = call?.[1]?.params as Record<string, unknown> | undefined
    expect(params).toMatchObject({ sort_by: 'created_at', sort_dir: 'desc' })
  })

  it('an unmapped FE column key never reaches the request as sort_by/sort_dir (would 422 the whitelist)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    renderHook(() => useCandidatesData({
      filterParams: {}, page: 1, pageSize: 25, t, setActionMsg: vi.fn(), sort: { by: 'title', dir: 'asc' },
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
    const params = call?.[1]?.params as Record<string, unknown> | undefined
    expect(params).not.toHaveProperty('sort_by')
    expect(params).not.toHaveProperty('sort_dir')
  })

  it('maps every column the reference adoption wires (name/created/lastContact), one request per key', async () => {
    const cases: Array<[string, string]> = [
      ['name', 'last_name'],
      ['created', 'created_at'],
      ['lastContact', 'last_contact_at'],
    ]
    for (const [by, sortBy] of cases) {
      vi.clearAllMocks()
      vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
      heavyGetMock.mockResolvedValue({ data: { data: null } })
      renderHook(() => useCandidatesData({
        filterParams: {}, page: 1, pageSize: 25, t, setActionMsg: vi.fn(), sort: { by, dir: 'asc' },
      }), { wrapper })

      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
      const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
      const params = call?.[1]?.params as Record<string, unknown> | undefined
      expect(params).toMatchObject({ sort_by: sortBy, sort_dir: 'asc' })
    }
  })

  it('stats stays sortless — a sort never leaks into the /candidates/stats request', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    renderHook(() => useCandidatesData({
      filterParams: {}, page: 1, pageSize: 25, t, setActionMsg: vi.fn(), sort: { by: 'created', dir: 'desc' },
    }), { wrapper })

    await waitFor(() => expect(heavyGetMock).toHaveBeenCalledWith('/candidates/stats', expect.anything()))
    const statsParams = heavyGetMock.mock.calls[0][1]?.params as Record<string, unknown> | undefined
    expect(statsParams).not.toHaveProperty('sort_by')
    expect(statsParams).not.toHaveProperty('sort_dir')
  })
})

// STATS-SCOPE-1 (2026-08-22 audit): the stats request must carry ONLY the view-scope
// subset of filterParams — never a dimension/attention filter — while the LIST request
// keeps receiving the full filterParams unchanged (§3B: KPI totals are server-wide).
describe('useCandidatesData · stats stays server-wide (STATS-SCOPE-1)', () => {
  it('a dimension/attention filter (intake_planned) reaches the list but NOT the stats request', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    const filterParams = { intake_planned: 1, status: ['available'], search: 'jan' }
    renderHook(() => useCandidatesData({ filterParams, page: 1, pageSize: 25, t, setActionMsg: vi.fn() }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const listParams = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')?.[1]?.params as Record<string, unknown> | undefined
    expect(listParams).toMatchObject({ intake_planned: 1, status: ['available'], search: 'jan' })

    await waitFor(() => expect(heavyGetMock).toHaveBeenCalledWith('/candidates/stats', expect.anything()))
    const statsParams = heavyGetMock.mock.calls[0][1]?.params as Record<string, unknown> | undefined
    expect(statsParams).not.toHaveProperty('intake_planned')
    expect(statsParams).not.toHaveProperty('status')
    expect(statsParams).not.toHaveProperty('search')
    expect(statsParams).toEqual({})
  })

  it('the archived view-scope flag reaches the stats request too', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    const filterParams = { include_archived: 1, status: ['blacklist'] }
    renderHook(() => useCandidatesData({ filterParams, page: 1, pageSize: 25, t, setActionMsg: vi.fn() }), { wrapper })

    await waitFor(() => expect(heavyGetMock).toHaveBeenCalledWith('/candidates/stats', expect.anything()))
    const statsParams = heavyGetMock.mock.calls[0][1]?.params as Record<string, unknown> | undefined
    expect(statsParams).toEqual({ include_archived: 1 })
  })

  it('changing only a dimension filter never re-fires the stats request (stable statsParams key)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    const { rerender } = renderHook(
      ({ filterParams }) => useCandidatesData({ filterParams, page: 1, pageSize: 25, t, setActionMsg: vi.fn() }),
      { wrapper, initialProps: { filterParams: { status: ['available'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(heavyGetMock).toHaveBeenCalledTimes(1))
    const candidatesCallsBefore = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/candidates').length

    rerender({ filterParams: { status: ['placed'] } })
    await waitFor(() => {
      const candidatesCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/candidates').length
      expect(candidatesCallsAfter).toBe(candidatesCallsBefore + 1) // list refetches on the new dimension value
    })
    expect(heavyGetMock).toHaveBeenCalledTimes(1) // stats does not refetch — statsParams stayed {} both times
  })
})
