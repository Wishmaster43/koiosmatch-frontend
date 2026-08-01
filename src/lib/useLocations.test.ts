/**
 * useLocations — the identity of the empty result is load-bearing, not cosmetic.
 *
 * While the query is loading (or has failed) this hook used to return a fresh `[]` on
 * every render. Callers memoise on it, so every derived value rebuilt each render; on the
 * applications page that reached the filter-registration effect and looped the app until
 * the error boundary caught it. tsc and 2671 unit tests were green throughout — only the
 * smoke suite saw it (01-08).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLocations } from './useLocations'

const queryData = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: queryData.current }) }))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() }, unwrapList: () => ({ rows: [] }) }))

describe('useLocations', () => {
  it('returns the SAME empty array across renders while the query has no data', () => {
    queryData.current = undefined
    const { result, rerender } = renderHook(() => useLocations())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(result.current).toEqual([])
  })

  it('passes the resolved rows straight through once they arrive', () => {
    queryData.current = [{ value: 'b1', label: 'Amsterdam' }]
    const { result } = renderHook(() => useLocations())
    expect(result.current).toEqual([{ value: 'b1', label: 'Amsterdam' }])
  })
})
