/**
 * useReportList — a failed GET raises `error` (audit r2-ui-states-2) instead of
 * silently reading as an empty list; a successful GET leaves it false.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useReportList } from './useReportList'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('useReportList', () => {
  it('raises error on a rejected request and clears the rows', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useReportList<{ id: number }>('/workflow-runs'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.rows).toEqual([])
    expect(api.get).toHaveBeenCalledWith('/workflow-runs')
  })

  it('keeps error false on a successful request', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 1 }] } })
    const { result } = renderHook(() => useReportList<{ id: number }>('/messages'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.rows).toEqual([{ id: 1 }])
  })
})
