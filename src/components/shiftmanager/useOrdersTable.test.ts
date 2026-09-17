/**
 * useOrdersTable — the page-load effect carries an alive guard (audit r2-context-sm-4):
 * when a user pages fast, a SLOWER earlier response must never overwrite the later page.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useOrdersTable } from './useOrdersTable'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(async () => ({ data: {} })), put: vi.fn(async () => ({ data: {} })) } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ refreshUser: vi.fn() }) }))
vi.mock('@/lib/usePageSize', () => ({ useDefaultPageSize: () => 25 }))

afterEach(() => vi.clearAllMocks())

describe('useOrdersTable · stale responses never win', () => {
  it('keeps the rows of the LAST requested page when an earlier request resolves later', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    let resolveSecond: (v: unknown) => void = () => {}
    vi.mocked(api.get)
      .mockImplementationOnce(() => new Promise(r => { resolveFirst = r }))
      .mockImplementationOnce(() => new Promise(r => { resolveSecond = r }))
    const { result } = renderHook(() => useOrdersTable({ selectedMonth: '2026-09', search: '', selectedStatuses: [], sort: { key: 'date', dir: 'desc' } }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
    // Page forward before the first page arrives.
    act(() => { result.current.setPage(2) })
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    // The second page arrives first, then the stale first page.
    await act(async () => { resolveSecond({ data: { data: [{ id: 'p2' }], meta: { total: 2, last_page: 2 } } }) })
    await act(async () => { resolveFirst({ data: { data: [{ id: 'p1' }], meta: { total: 2, last_page: 2 } } }) })
    expect(result.current.rows.map(r => String((r as unknown as { id: string }).id))).toEqual(['p2'])
  })
})

describe('useOrdersTable · error state', () => {
  it('exposes error=true on a failed fetch, distinct from the ordinary empty state', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useOrdersTable({ selectedMonth: '2026-09', search: '', selectedStatuses: [], sort: { key: 'date', dir: 'desc' } }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.rows).toEqual([])
  })
})
