/**
 * useMatchArchive — pins the per-id archive/restore contract (enkelstuks-sweep,
 * BE 9170e40): DELETE /matches/{id} + POST /matches/{id}/restore, never a bulk
 * route with a single id. Also pins the 409 (active contract) message split and
 * that a cancelled confirm() never calls the API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchArchive } from './useMatchArchive'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { delete: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn() }))

import api from '@/lib/api'
import { notify } from '@/lib/notify'

const del  = api.delete as unknown as ReturnType<typeof vi.fn>
const post = api.post as unknown as ReturnType<typeof vi.fn>

function harness() {
  const onPatch  = vi.fn()
  const onReload = vi.fn()
  const hook = renderHook(() => useMatchArchive({ onPatch, onReload }))
  return { hook, onPatch, onReload }
}

beforeEach(() => {
  del.mockReset(); post.mockReset(); vi.mocked(notify).mockClear()
})

describe('useMatchArchive · archiveMatch', () => {
  it('calls the per-id DELETE route (never bulk-with-one-id)', async () => {
    del.mockResolvedValue({})
    const { hook, onPatch, onReload } = harness()
    act(() => { hook.result.current.archiveMatch('m1') })
    // Confirm via the shared ConfirmDialog (replaces window.confirm).
    act(() => { hook.result.current.dialog.props.onConfirm() })
    await waitFor(() => expect(del).toHaveBeenCalledWith('/matches/m1'))
    expect(del).not.toHaveBeenCalledWith(expect.stringContaining('bulk'))
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('m1', expect.objectContaining({ archived: true })))
    expect(onReload).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('success', expect.any(String))
  })

  it('does nothing when the confirm dialog is cancelled', async () => {
    const { hook, onPatch } = harness()
    act(() => { hook.result.current.archiveMatch('m1') })
    act(() => { hook.result.current.dialog.props.onCancel() })
    expect(del).not.toHaveBeenCalled()
    expect(onPatch).not.toHaveBeenCalled()
  })

  it('surfaces the active-contract message on a 409 (never the generic error)', async () => {
    del.mockRejectedValue({ response: { status: 409 } })
    const { hook, onPatch } = harness()
    act(() => { hook.result.current.archiveMatch('m1') })
    act(() => { hook.result.current.dialog.props.onConfirm() })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'drawer.archiveBlockedActiveContract'))
    expect(onPatch).not.toHaveBeenCalled()
  })

  it('surfaces the generic failure message on any other error', async () => {
    del.mockRejectedValue({ response: { status: 500 } })
    const { hook } = harness()
    act(() => { hook.result.current.archiveMatch('m1') })
    act(() => { hook.result.current.dialog.props.onConfirm() })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'drawer.archiveFailed'))
  })
})

describe('useMatchArchive · restoreMatch', () => {
  it('calls the per-id restore route and clears the local archived flag', async () => {
    post.mockResolvedValue({})
    const { hook, onPatch, onReload } = harness()
    await act(async () => { await hook.result.current.restoreMatch('m1') })
    expect(post).toHaveBeenCalledWith('/matches/m1/restore')
    expect(onPatch).toHaveBeenCalledWith('m1', { archived: false, archivedAt: null })
    expect(onReload).toHaveBeenCalled()
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
  })

  it('surfaces a failure toast when the restore call rejects', async () => {
    post.mockRejectedValue({ response: { status: 500 } })
    const { hook, onPatch } = harness()
    await act(async () => { await hook.result.current.restoreMatch('m1') })
    expect(onPatch).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('error', expect.any(String))
  })
})
