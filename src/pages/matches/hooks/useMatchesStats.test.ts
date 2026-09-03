/**
 * useMatchesStats — MATCH-APPROVAL-QUICKVIEW: the 'Te beoordelen' KPI tile's
 * server-aggregated count (GET /matches/stats.pending_approval), decoupled from
 * whatever `rows` the quick-view toggle has narrowed to (§13: assert the request).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMatchesStats } from './useMatchesStats'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useMatchesStats', () => {
  it('reads pending_approval off GET /matches/stats', async () => {
    mockedGet.mockResolvedValue({ data: { total: 5, pending_approval: 3, by_origin: { direct: 5, application: 0 } } })
    const { result } = renderHook(() => useMatchesStats())
    await waitFor(() => expect(result.current.pendingApproval).toBe(3))
    expect(mockedGet).toHaveBeenCalledWith('/matches/stats', { params: {} })
  })

  it('sends include_archived: 1 when the archived/trash view is on, never approval_status', async () => {
    mockedGet.mockResolvedValue({ data: { total: 0, pending_approval: 0, by_origin: { direct: 0, application: 0 } } })
    renderHook(() => useMatchesStats(true))
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(mockedGet).toHaveBeenCalledWith('/matches/stats', { params: { include_archived: 1 } })
  })

  it('falls back to 0 on a failing/missing endpoint, never a stale count', async () => {
    mockedGet.mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useMatchesStats())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    await waitFor(() => expect(result.current.pendingApproval).toBe(0))
  })

  it('refetches when refreshTick bumps', async () => {
    mockedGet.mockResolvedValue({ data: { total: 1, pending_approval: 1, by_origin: { direct: 1, application: 0 } } })
    const { rerender } = renderHook(({ tick }) => useMatchesStats(false, tick), { initialProps: { tick: 0 } })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    rerender({ tick: 1 })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
  })
})
