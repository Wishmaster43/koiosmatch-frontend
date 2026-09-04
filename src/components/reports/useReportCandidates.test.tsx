/**
 * useReportCandidates — pins the exact request (route + per_page), never only
 * that a callback fired (§13). PERF-1 follow-up: a prior repair capped this
 * fetch below the tenant's configured `candidates_per_page` setting; this test
 * proves the hook now honours whatever perPage it is given, so the setting's
 * own contract holds again.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useReportCandidates } from './useReportCandidates'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useReportCandidates', () => {
  it('fetches /sm_candidates with the exact perPage it is given (honours the configured setting)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    renderHook(() => useReportCandidates(500))

    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(mockedGet).toHaveBeenCalledWith('/sm_candidates?per_page=500')
  })

  it('normalises first_name/last_name into firstname/lastname on the returned rows', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 1, first_name: 'Jan', last_name: 'Jansen' }] } })
    const { result } = renderHook(() => useReportCandidates(500))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.candidates).toEqual([
      expect.objectContaining({ firstname: 'Jan', lastname: 'Jansen' }),
    ])
    expect(result.current.error).toBe(false)
  })

  it('reports error when the request fails, without throwing', async () => {
    mockedGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useReportCandidates(500))

    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.candidates).toEqual([])
  })
})
