/**
 * useApplicationsData · DATATABLE-SORT-1 reference adoption — pins the REQUEST
 * shape (§13: assert the request, not just that a callback fired) for the
 * FE-column-keyed `sort` param this hook now accepts:
 *   - a mapped column (e.g. "created") must add sort_by/sort_dir to BOTH the
 *     list and the wide query (the task's explicit "list + wide queries");
 *   - an UNMAPPED column (e.g. "vacancy" — not in ApplicationQuery::SORTS) must
 *     never leak a sort_by/sort_dir the backend would 422 on;
 *   - no sort at all reproduces the EXACT pre-adoption request shape (no
 *     sort_by/sort_dir keys at all) — the "unsorted default unchanged" guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useApplicationsData } from './useApplicationsData'

// Stub only the axios-like client; unwrap/unwrapList stay real (pure helpers).
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

// Pull the params object the hook sent for a specific /applications call —
// there are two (list + wide) in flight per render, so filter by an
// unambiguous marker each test sets (per_page differs: list uses pageSize,
// wide always uses the 500 ceiling).
function paramsFor(perPage: number) {
  const call = vi.mocked(api.get).mock.calls.find(([url, cfg]) =>
    url === '/applications' && (cfg as { params?: { per_page?: number } })?.params?.per_page === perPage)
  return call?.[1]?.params as Record<string, unknown> | undefined
}

describe('useApplicationsData · sort request shape (DATATABLE-SORT-1)', () => {
  it('unsorted default: no sort_by/sort_dir on either query (byte-identical to before this change)', async () => {
    renderHook(() => useApplicationsData({
      view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [], sort: null,
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
    const listParams = paramsFor(25)
    const wideParams = paramsFor(500)
    expect(listParams).not.toHaveProperty('sort_by')
    expect(listParams).not.toHaveProperty('sort_dir')
    expect(wideParams).not.toHaveProperty('sort_by')
    expect(wideParams).not.toHaveProperty('sort_dir')
  })

  it('a column mapped to a real backend field sends sort_by/sort_dir on BOTH the list and the wide query', async () => {
    renderHook(() => useApplicationsData({
      view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [],
      sort: { by: 'created', dir: 'desc' },
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
    const listParams = paramsFor(25)
    const wideParams = paramsFor(500)
    expect(listParams).toMatchObject({ sort_by: 'created_at', sort_dir: 'desc' })
    expect(wideParams).toMatchObject({ sort_by: 'created_at', sort_dir: 'desc' })
  })

  it('an unmapped FE column key never reaches the request as sort_by/sort_dir (would 422 the whitelist)', async () => {
    renderHook(() => useApplicationsData({
      view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [],
      sort: { by: 'vacancy', dir: 'asc' },
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
    const listParams = paramsFor(25)
    const wideParams = paramsFor(500)
    expect(listParams).not.toHaveProperty('sort_by')
    expect(listParams).not.toHaveProperty('sort_dir')
    expect(wideParams).not.toHaveProperty('sort_by')
    expect(wideParams).not.toHaveProperty('sort_dir')
  })

  it('maps every column the reference adoption wires (candidate/score/phase), one request per key', async () => {
    const cases: Array<[string, string]> = [
      ['candidate', 'candidate_last_name'],
      ['score', 'match_score'],
      ['phase', 'stage_order'],
    ]
    for (const [by, sortBy] of cases) {
      vi.clearAllMocks()
      vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
      renderHook(() => useApplicationsData({
        view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [],
        sort: { by, dir: 'asc' },
      }), { wrapper })

      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
      expect(paramsFor(25)).toMatchObject({ sort_by: sortBy, sort_dir: 'asc' })
    }
  })
})
