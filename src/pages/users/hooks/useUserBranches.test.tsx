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

  // USERS-SELECTALL root fix: select-all must not drain N values through the
  // per-value `toggle` (N racing PUTs, last response wins regardless of which
  // request actually carried the full set — the "select all snaps back"
  // symptom Danny reported). `toggleMany` computes the final set once and
  // fires exactly ONE PUT for it.
  it('applies a select-all batch as ONE PUT carrying the full id set', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ location_id: 'loc-1', name: 'Amsterdam' }] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: [
      { location_id: 'loc-1', name: 'Amsterdam' },
      { location_id: 'loc-2', name: 'Rotterdam' },
      { location_id: 'loc-3', name: 'Utrecht' },
    ] } })
    const { result } = renderHook(() => useUserBranches('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggleMany(['loc-2', 'loc-3'], true) })

    // Exactly one PUT, carrying every id (the already-assigned one plus the batch).
    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.put).toHaveBeenCalledWith('/users/u1/branches', { location_ids: ['loc-1', 'loc-2', 'loc-3'] })
    expect(result.current.branches.map(b => b.location_id)).toEqual(['loc-1', 'loc-2', 'loc-3'])
  })

  it('applies a clear-all batch as ONE PUT with the batch ids removed', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [
      { location_id: 'loc-1', name: 'Amsterdam' }, { location_id: 'loc-2', name: 'Rotterdam' },
    ] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: [] } })
    const { result } = renderHook(() => useUserBranches('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggleMany(['loc-1', 'loc-2'], false) })

    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.put).toHaveBeenCalledWith('/users/u1/branches', { location_ids: [] })
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

// USERS-ROLES-LOC-1 phase 3: per-branch can_view/can_update/can_delete flags.
// Request-level (§13): the exact `branches` replace-set body, changed flag only
// on the touched row so unrelated rows keep their server-side values.
describe('useUserBranches · setFlag (phase 3)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PUTs a branches replace-set with the changed flag only on the touched row', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [
        { location_id: 'loc-1', name: 'Amsterdam', can_view: true, can_update: true, can_delete: false },
        { location_id: 'loc-2', name: 'Rotterdam', can_view: true, can_update: true, can_delete: false },
      ] },
    })
    vi.mocked(api.put).mockResolvedValueOnce({
      data: { data: [
        { location_id: 'loc-1', name: 'Amsterdam', can_view: true, can_update: true, can_delete: true },
        { location_id: 'loc-2', name: 'Rotterdam', can_view: true, can_update: true, can_delete: false },
      ] },
    })
    const { result } = renderHook(() => useUserBranches('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.setFlag('loc-1', 'can_delete', true) })

    expect(api.put).toHaveBeenCalledWith('/users/u1/branches', {
      branches: [
        { location_id: 'loc-1', can_delete: true },
        { location_id: 'loc-2' },
      ],
    })
    expect(result.current.branches[0].can_delete).toBe(true)
    expect(result.current.saving).toBe(false)
  })

  it('reverts the flag and notifies on a failed PUT', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{ location_id: 'loc-1', name: 'Amsterdam', can_view: true, can_update: true, can_delete: false }] },
    })
    vi.mocked(api.put).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useUserBranches('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.setFlag('loc-1', 'can_update', false) })

    expect(result.current.branches[0].can_update).toBe(true)
    expect(notifyError).toHaveBeenCalledWith('branches.saveFailed')
  })
})
