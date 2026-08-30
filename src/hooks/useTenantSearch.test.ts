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
    await waitFor(() => expect(result.current.options.length).toBe(1))
    const lastCall = vi.mocked(api.get).mock.calls.at(-1)
    expect(lastCall?.[1]?.params).toMatchObject({ search: 'yes', per_page: 25 })
    expect(result.current.options[0]).toEqual({ value: 't1', label: 'Yesway Flex' })
  })
})
