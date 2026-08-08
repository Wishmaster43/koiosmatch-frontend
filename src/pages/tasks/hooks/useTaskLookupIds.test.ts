/**
 * useTaskLookupIds — proves the slug→uuid maps are built from the RAW lookup
 * endpoints (id+value), tolerate a failed/empty endpoint (map stays empty, never
 * throws), and never resolve a slug that has no matching row.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTaskLookupIds } from './useTaskLookupIds'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

const mockedGet = vi.mocked((await import('@/lib/api')).default.get)

afterEach(() => vi.clearAllMocks())

describe('useTaskLookupIds', () => {
  it('builds slug→uuid maps from the raw lookup endpoints', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/task-types')     return Promise.resolve({ data: [{ id: 'type-1', value: 'call', label: 'Call' }] })
      if (url === '/task-statuses')  return Promise.resolve({ data: [{ id: 'status-1', value: 'todo', label: 'Todo' }] })
      if (url === '/task-priorities') return Promise.resolve({ data: [{ id: 'prio-1', value: 'high', label: 'High' }] })
      return Promise.reject(new Error('unexpected url'))
    })

    const { result } = renderHook(() => useTaskLookupIds())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.maps).toEqual({
      type: { call: 'type-1' }, status: { todo: 'status-1' }, priority: { high: 'prio-1' },
    })
  })

  it('leaves an unresolved slug out of the map instead of guessing', async () => {
    mockedGet.mockResolvedValue({ data: [{ id: 'status-1', value: 'todo', label: 'Todo' }] })
    const { result } = renderHook(() => useTaskLookupIds())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.maps.status.done).toBeUndefined()
  })

  it('a rejected endpoint leaves that map empty rather than throwing', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/task-types') return Promise.reject(new Error('boom'))
      return Promise.resolve({ data: [] })
    })
    const { result } = renderHook(() => useTaskLookupIds())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.maps).toEqual({ type: {}, status: {}, priority: {} })
  })
})
