/**
 * useOpportunityArchive — pins the per-id archive/restore contract: DELETE
 * /opportunities/{id} + POST /opportunities/{id}/restore (both pre-date this
 * task; C-41's `bulk/archive` stays a SEPARATE route for the actual bulk bar).
 * Also pins that a cancelled confirm() never calls the API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOpportunityArchive } from './useOpportunityArchive'

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
  const hook = renderHook(() => useOpportunityArchive({ onPatch, onReload }))
  return { hook, onPatch, onReload }
}

beforeEach(() => {
  del.mockReset(); post.mockReset(); vi.mocked(notify).mockClear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('useOpportunityArchive · archiveOpportunity', () => {
  it('calls the per-id DELETE route (never bulk/archive with one id)', async () => {
    del.mockResolvedValue({})
    const { hook, onPatch, onReload } = harness()
    await act(async () => { await hook.result.current.archiveOpportunity('o1') })
    expect(del).toHaveBeenCalledWith('/opportunities/o1')
    expect(del).not.toHaveBeenCalledWith(expect.stringContaining('bulk'))
    expect(onPatch).toHaveBeenCalledWith('o1', expect.objectContaining({ archived: true }))
    expect(onReload).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('success', expect.any(String))
  })

  it('does nothing when the confirm dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { hook, onPatch } = harness()
    await act(async () => { await hook.result.current.archiveOpportunity('o1') })
    expect(del).not.toHaveBeenCalled()
    expect(onPatch).not.toHaveBeenCalled()
  })

  it('surfaces a failure toast when the delete call rejects', async () => {
    del.mockRejectedValue({ response: { status: 500 } })
    const { hook, onPatch } = harness()
    await act(async () => { await hook.result.current.archiveOpportunity('o1') })
    expect(onPatch).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('error', expect.any(String))
  })
})

describe('useOpportunityArchive · restoreOpportunity', () => {
  it('calls the per-id restore route and clears the local archived flag', async () => {
    post.mockResolvedValue({ data: { restored: true } })
    const { hook, onPatch, onReload } = harness()
    await act(async () => { await hook.result.current.restoreOpportunity('o1') })
    expect(post).toHaveBeenCalledWith('/opportunities/o1/restore')
    expect(onPatch).toHaveBeenCalledWith('o1', { archived: false, archivedAt: null })
    expect(onReload).toHaveBeenCalled()
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
  })

  it('surfaces a failure toast when the restore call rejects', async () => {
    post.mockRejectedValue({ response: { status: 500 } })
    const { hook, onPatch } = harness()
    await act(async () => { await hook.result.current.restoreOpportunity('o1') })
    expect(onPatch).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('error', expect.any(String))
  })
})
