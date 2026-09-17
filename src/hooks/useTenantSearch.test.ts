/**
 * useTenantSearch — pins the request shape (search + per_page against /tenants)
 * and the mapped {value,label} option shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { useTenantSearch } from './useTenantSearch'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})

beforeEach(() => vi.clearAllMocks())

describe('useTenantSearch', () => {
  it('requests /tenants with an undefined search and per_page 25 on mount', async () => {
    renderHook(() => useTenantSearch())
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/tenants')
    expect(config?.params).toMatchObject({ search: undefined, per_page: 25 })
  })

  it('re-requests with the trimmed search term and maps rows to {value,label}', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 't1', name: 'Yesway Flex' }] } } as never)
    const { result } = renderHook(() => useTenantSearch())
    act(() => result.current.onSearch('  yes  '))
    // The mount request answers first; wait for the DEBOUNCED search request itself.
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some((c) => (c[1]?.params as { search?: string } | undefined)?.search === 'yes')).toBe(true))
    await waitFor(() => expect(result.current.options.length).toBe(1))
    const lastCall = vi.mocked(api.get).mock.calls.at(-1)
    expect(lastCall?.[1]?.params).toMatchObject({ search: 'yes', per_page: 25 })
    expect(result.current.options[0]).toEqual({ value: 't1', label: 'Yesway Flex' })
  })

  it('sets error=true on a failed search instead of silently reporting an empty option list', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useTenantSearch())
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.options).toEqual([])
  })

  it('debounces a keystroke burst into one request for the final term (~250 ms, mirrors TenantSwitcher)', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useTenantSearch())
      await act(async () => { await vi.advanceTimersByTimeAsync(300) })
      const before = vi.mocked(api.get).mock.calls.length
      act(() => result.current.onSearch('y'))
      act(() => result.current.onSearch('ye'))
      act(() => result.current.onSearch('yes'))
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      expect(vi.mocked(api.get).mock.calls.length).toBe(before)
      await act(async () => { await vi.advanceTimersByTimeAsync(300) })
      expect(vi.mocked(api.get).mock.calls.length).toBe(before + 1)
      expect(vi.mocked(api.get).mock.calls.at(-1)?.[1]?.params).toMatchObject({ search: 'yes', per_page: 25 })
    } finally {
      vi.useRealTimers()
    }
  })
})
