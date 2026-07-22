/**
 * useDashboardData — regression test for the re-audit finding: /candidates/stats
 * and /dashboard used to catch(()=>{}), so a failed fetch left `stats`/`dash` at
 * null with no loading/error signal — Dashboard.tsx then rendered a KPI strip full
 * of "—" that read as real zeros. The two critical feeds now drive `loading`/
 * `error`; the best-effort feeds (opportunities stats, dashboard charts) stay
 * fail-soft and must NOT flip `error`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDashboardData } from './useDashboardData'
import api from '@/lib/api'

// heavyGet is the shared guarded-GET wrapper (dedup + cooldown) — the hook only
// cares about the resolved/rejected axios-shaped promise, so a route dispatch is enough.
const heavyGetMock = vi.fn()
vi.mock('@/lib/heavyGet', () => ({ heavyGet: (...args: unknown[]) => heavyGetMock(...args) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// Resolves the light matches/vacancies meta.total fetches so those effects settle quietly.
const resolveMeta = () => mockedGet.mockResolvedValue({ data: { meta: { total: 0 } } })

describe('useDashboardData · critical-feed error signalling', () => {
  it('starts loading and clears once both critical feeds resolve', async () => {
    resolveMeta()
    heavyGetMock.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
  })

  it('sets error when /candidates/stats fails with no response object (network/timeout)', async () => {
    resolveMeta()
    heavyGetMock.mockImplementation((url: string) =>
      url === '/candidates/stats' ? Promise.reject(new Error('Network Error')) : Promise.resolve({ data: { data: {} } }))
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })

  it('sets error when /dashboard fails', async () => {
    resolveMeta()
    heavyGetMock.mockImplementation((url: string) =>
      url === '/dashboard' ? Promise.reject({ response: { status: 500 } }) : Promise.resolve({ data: { data: {} } }))
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })

  it('stays fail-soft (no error) when only the best-effort feeds fail', async () => {
    resolveMeta()
    heavyGetMock.mockImplementation((url: string) =>
      (url === '/opportunities/stats' || url === '/dashboard/charts')
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ data: { data: {} } }))
    const { result } = renderHook(() => useDashboardData({ filterParams: {} }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
  })

  it('retry() re-issues the critical fetches', async () => {
    resolveMeta()
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
