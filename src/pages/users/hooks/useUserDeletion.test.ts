/**
 * useUserDeletion — the invariant this whole feature exists for: a coupled user
 * is NEVER cut loose from its records (USER-SOFTDELETE-1).
 *
 * These tests assert the REQUESTS, not just that a callback fired (§13): the
 * first DELETE goes out bare, the 422 `{requires_transfer, owned}` opens the
 * transfer state instead of surfacing an error, and the second DELETE repeats
 * the same URL WITH `{transfer_to_user_id}` in the body. The 422 bodies below
 * are the ones measured live against koiosmatch-api on 09-08.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUserDeletion } from './useUserDeletion'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { ManagedUser } from '@/types/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { delete: vi.fn() } }))

const testUser: ManagedUser = { id: 'u1', firstname: 'Kelly', lastname: 'Yesway', email: 'kelly@yesway.nl' }
const SUCCESSOR_ID = 'u2'

// The exact 422 the backend answers a still-owning user with (measured 09-08).
const transferRequired = {
  response: {
    status: 422,
    data: {
      message: 'Deze gebruiker is nog eigenaar van objecten.',
      requires_transfer: true,
      owned: { total: 131, by_type: { candidates: 112, vacancies: 18, tasks: 1 } },
    },
  },
}

describe('useUserDeletion · ownership transfer gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes straight away when the user owns nothing', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { message: 'User deleted', transferred: [] } })
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useUserDeletion(onDeleted))

    await act(async () => { await result.current.requestDelete(testUser) })

    // Bare DELETE — no body, no transfer needed.
    expect(api.delete).toHaveBeenCalledWith('/users/u1')
    expect(onDeleted).toHaveBeenCalledWith('u1')
    expect(result.current.target).toBeNull()
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('opens the transfer dialog with the server counts on a 422 — never a generic error', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(transferRequired)
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useUserDeletion(onDeleted))

    await act(async () => { await result.current.requestDelete(testUser) })

    await waitFor(() => expect(result.current.target).toEqual(testUser))
    expect(result.current.owned).toEqual({ total: 131, by_type: { candidates: 112, vacancies: 18, tasks: 1 } })
    // The 422 is a hand-off, not a failure: nothing was removed and nothing was shouted.
    expect(onDeleted).not.toHaveBeenCalled()
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('repeats the DELETE with transfer_to_user_id in the body once a successor is chosen', async () => {
    vi.mocked(api.delete)
      .mockRejectedValueOnce(transferRequired)
      .mockResolvedValueOnce({ data: { message: 'User deleted', transferred: { candidates: 112 } } })
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useUserDeletion(onDeleted))

    // Step 1 — blocked by the gate.
    await act(async () => { await result.current.requestDelete(testUser) })
    await waitFor(() => expect(result.current.target).toEqual(testUser))

    // Step 2 — the same route, now carrying the successor.
    await act(async () => { await result.current.confirmTransfer(SUCCESSOR_ID) })

    expect(api.delete).toHaveBeenCalledTimes(2)
    expect(vi.mocked(api.delete).mock.calls[0]).toEqual(['/users/u1'])
    expect(vi.mocked(api.delete).mock.calls[1]).toEqual(['/users/u1', { data: { transfer_to_user_id: 'u2' } }])
    expect(onDeleted).toHaveBeenCalledWith('u1')
    expect(notifySuccess).toHaveBeenCalledWith('delete.transferred')
    // Dialog closed only after the server confirmed.
    expect(result.current.target).toBeNull()
  })

  it('keeps the dialog open and reports the failure when the transfer delete fails', async () => {
    vi.mocked(api.delete)
      .mockRejectedValueOnce(transferRequired)
      .mockRejectedValueOnce({ response: { status: 500, data: { message: 'Boom' } } })
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useUserDeletion(onDeleted))

    await act(async () => { await result.current.requestDelete(testUser) })
    await act(async () => { await result.current.confirmTransfer(SUCCESSOR_ID) })

    expect(notifyError).toHaveBeenCalledWith('Boom')
    expect(onDeleted).not.toHaveBeenCalled()
    // The choice is not lost — the user can pick again or cancel.
    expect(result.current.target).toEqual(testUser)
  })

  it('surfaces a 422 WITHOUT requires_transfer as a real error (e.g. deleting yourself)', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Je kunt je eigen account niet verwijderen.' } },
    })
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useUserDeletion(onDeleted))

    await act(async () => { await result.current.requestDelete(testUser) })

    expect(notifyError).toHaveBeenCalledWith('Je kunt je eigen account niet verwijderen.')
    expect(result.current.target).toBeNull()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('never issues a second DELETE when the dialog is cancelled', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(transferRequired)
    const { result } = renderHook(() => useUserDeletion(vi.fn()))

    await act(async () => { await result.current.requestDelete(testUser) })
    act(() => { result.current.close() })

    expect(result.current.target).toBeNull()
    expect(api.delete).toHaveBeenCalledTimes(1)
  })
})
