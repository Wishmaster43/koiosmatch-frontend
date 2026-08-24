/**
 * useDashboardData — regression test for the re-audit finding: /candidates/stats
 * and /dashboard used to catch(()=>{}), so a failed fetch left `stats`/`dash` at
 * null with no loading/error signal — Dashboard.tsx then rendered a KPI strip full
 * of "—" that read as real zeros. The two critical feeds now drive `loading`/
 * `error`; the best-effort feed (opportunities stats) stays fail-soft and must
 * NOT flip `error`.
 *
 * K1 (DASH-KPI-SERVER-FE-1, BE K-168): the matches/vacancies meta.total probe
 * fetches and the /applications/stats attention feed are gone — dash.kpis now
 * carries everything they used to feed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDashboardData } from './useDashboardData'

// heavyGet is the shared guarded-GET wrapper (dedup + cooldown) — the hook only
// cares about the resolved/rejected axios-shaped promise, so a route dispatch is enough.
const heavyGetMock = vi.fn()
vi.mock('@/lib/heavyGet', () => ({ heavyGet: (...args: unknown[]) => heavyGetMock(...args) }))

afterEach(() => vi.clearAllMocks())

describe('useDashboardData · critical-feed error signalling', () => {
  it('starts loading and clears once both critical feeds resolve', async () => {
    heavyGetMock.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
  })

  it('sets error when /candidates/stats fails with no response object (network/timeout)', async () => {
    heavyGetMock.mockImplementation((url: string) =>
      url === '/candidates/stats' ? Promise.reject(new Error('Network Error')) : Promise.resolve({ data: { data: {} } }))
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })

  it('sets error when /dashboard fails', async () => {
    heavyGetMock.mockImplementation((url: string) =>
      url === '/dashboard' ? Promise.reject({ response: { status: 500 } }) : Promise.resolve({ data: { data: {} } }))
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })

  it('stays fail-soft (no error) when only the best-effort feed fails', async () => {
    heavyGetMock.mockImplementation((url: string) =>
      url === '/opportunities/stats'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ data: { data: {} } }))
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.opp).toBeNull()
  })

  // K1 — the server-computed kpis block passes through /dashboard untouched.
  // K1 negative pin: the retired count probes must never come back — not via
  // heavyGet and not via a quiet api.get reintroduction (the removed calls used
  // api.get, which this mock would not catch on its own).
  it('never fetches /matches, /vacancies or /applications/stats — the server KPI block replaced them', async () => {
    heavyGetMock.mockResolvedValue({ data: { data: {} } })
    const apiGetSpy = vi.spyOn((await import('@/lib/api')).default, 'get').mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const urls = [...heavyGetMock.mock.calls, ...apiGetSpy.mock.calls].map(c => String(c[0]))
    for (const gone of ['/matches', '/vacancies', '/applications/stats']) {
      expect(urls.some(u => u === gone || u.startsWith(`${gone}?`)), `${gone} must stay removed`).toBe(false)
    }
    apiGetSpy.mockRestore()
  })

  it('carries dash.kpis through from the /dashboard response', async () => {
    heavyGetMock.mockImplementation((url: string) => {
      if (url === '/dashboard') return Promise.resolve({ data: { kpis: { open_vacancies: 3, placements: null } } })
      return Promise.resolve({ data: { data: {} } })
    })
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dash).toEqual({ kpis: { open_vacancies: 3, placements: null } })
  })

  it('retry() re-issues the critical fetches', async () => {
    heavyGetMock.mockImplementation((url: string) =>
      url === '/dashboard' ? Promise.reject({ response: { status: 500 } }) : Promise.resolve({ data: { data: {} } }))
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.error).toBe(true))

    heavyGetMock.mockClear()
    heavyGetMock.mockResolvedValue({ data: { data: {} } })
    act(() => { result.current.retry() })

    await waitFor(() => expect(result.current.error).toBe(false))
    expect(heavyGetMock).toHaveBeenCalledWith('/dashboard', expect.anything())
  })
})
