/**
 * useMatchApprovalMode — proves the request contract (GET /settings/matching,
 * a stable query key, and unwrapping to just approval_mode). Mirrors
 * useLocations.test.ts's pattern of stubbing '@tanstack/react-query' directly,
 * so no QueryClientProvider is needed in the test tree.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMatchApprovalMode } from './useMatchApprovalMode'

const queryData = vi.hoisted(() => ({ current: undefined as unknown }))
const mockGet = vi.hoisted(() => vi.fn())
// Captures the options useQuery was called with, so the queryFn can be invoked
// directly to assert on the actual axios call (§13: the request, not just a callback).
const captured = vi.hoisted(() => ({
  key: undefined as unknown,
  fn: undefined as ((ctx: { signal?: AbortSignal }) => Promise<unknown>) | undefined,
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey: unknown; queryFn: (ctx: { signal?: AbortSignal }) => Promise<unknown> }) => {
    captured.key = opts.queryKey
    captured.fn = opts.queryFn
    return { data: queryData.current }
  },
}))
vi.mock('@/lib/api', () => ({ default: { get: mockGet }, unwrap: (res: { data?: unknown }) => res?.data }))

describe('useMatchApprovalMode', () => {
  it('requests GET /settings/matching under a stable query key and returns approval_mode', async () => {
    mockGet.mockResolvedValue({ data: { strictness: 'balanced', approval_mode: 'on_deviation' } })
    renderHook(() => useMatchApprovalMode())

    expect(captured.key).toEqual(['settings', 'matching'])
    const value = await captured.fn!({ signal: undefined })
    expect(mockGet).toHaveBeenCalledWith('/settings/matching', { signal: undefined })
    expect(value).toBe('on_deviation')
  })

  it('exposes the resolved value as approvalMode', () => {
    queryData.current = 'always'
    const { result } = renderHook(() => useMatchApprovalMode())
    expect(result.current.approvalMode).toBe('always')
  })

  it('stays undefined while loading (or on error) — the badge treats that as unknown', () => {
    queryData.current = undefined
    const { result } = renderHook(() => useMatchApprovalMode())
    expect(result.current.approvalMode).toBeUndefined()
  })

  // Transition safety: a cached pre-ab661e0d response with the Dutch wire value
  // must normalise to the English enum, never leak 'bij_afwijking' downstream.
  it('normalises the legacy Dutch wire value to the English enum', () => {
    queryData.current = 'bij_afwijking'
    const { result } = renderHook(() => useMatchApprovalMode())
    expect(result.current.approvalMode).toBe('on_deviation')
  })
})
