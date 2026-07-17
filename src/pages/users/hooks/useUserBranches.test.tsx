/**
 * useUserBranches — the per-user branch coupling (USERS-ROLES-LOC-1): loads the
 * current set, then toggles are optimistic PUT replace-sets that revert +
 * notifyError on failure (never a silent, unsaved-looking success — §3/AVG).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUserBranches } from './useUserBranches'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

describe('useUserBranches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the current branch set on mount', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ location_id: 'loc-1', name: 'Amsterdam' }] } })
    const { result } = renderHook(() => useUserBranches('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.branches).toEqual([{ location_id: 'loc-1', name: 'Amsterdam' }])
    expect(api.get).toHaveBeenCalledWith('/users/u1/branches')
  })

  it('optimistically adds a branch and reconciles with the server response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: [{ location_id: 'loc-2', name: 'Rotterdam' }] } })
    const { result } = renderHook(() => useUserBranches('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggle('loc-2') })

    expect(api.put).toHaveBeenCalledWith('/users/u1/branches', { location_ids: ['loc-2'] })
    expect(result.current.branches).toEqual([{ location_id: 'loc-2', name: 'Rotterdam' }])
    expect(result.current.saving).toBe(false)
  })

  it('reverts to the previous set and notifies on a failed toggle', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ location_id: 'loc-1', name: 'Amsterdam' }] } })
    vi.mocked(api.put).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useUserBranches('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggle('loc-2') })

    // Back to exactly the pre-toggle set — never a silently-wrong local state.
    expect(result.current.branches).toEqual([{ location_id: 'loc-1', name: 'Amsterdam' }])
    expect(notifyError).toHaveBeenCalledWith('branches.saveFailed')
  })
})
