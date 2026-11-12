/**
 * useMatchesBulkActions — a match is read-only (§3B), so the only bulk ops are
 * selection + authorization-gated coupling to an external backoffice. Pins the
 * queued/updated count reconciliation and the "not available yet" (404/503) vs.
 * "real error" (anything else) toast split.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useMatchesBulkActions } from './useMatchesBulkActions'
import type { Id } from '@/types/common'

// Keep the real isServiceUnavailable (503 check) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn() }))

import api from '@/lib/api'
import { notify } from '@/lib/notify'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const t = ((k: string) => k) as unknown as import('i18next').TFunction

function harness() {
  return renderHook(() => {
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set([1, 2]))
    const actions = useMatchesBulkActions({ selectedIds, setSelectedIds, t })
    return { selectedIds, actions }
  })
}

beforeEach(() => { post.mockReset(); vi.mocked(notify).mockClear() })

describe('useMatchesBulkActions · selection', () => {
  it('toggleRow adds/removes one id; toggleAll adds or clears the given ids', () => {
    const r = harness()
    act(() => r.result.current.actions.toggleRow(3))
    expect(r.result.current.selectedIds.has(3)).toBe(true)
    act(() => r.result.current.actions.toggleRow(3))
    expect(r.result.current.selectedIds.has(3)).toBe(false)

    act(() => r.result.current.actions.toggleAll([1, 2, 5], false))
    expect([...r.result.current.selectedIds].sort()).toEqual([1, 2, 5])
    act(() => r.result.current.actions.toggleAll([1, 2, 5], true))
    expect(r.result.current.selectedIds.size).toBe(0)
  })
})

// HF-CONTRACT-1: HelloFlex posts the module-gated /matches/bulk/couple route;
// Shiftmanager stays on the generic /sync/matches/bulk path (the couple route answers it 422).
describe('useMatchesBulkActions · bulkCouple', () => {
  it('HelloFlex POSTs /matches/bulk/couple with {match_ids, target}, reports the queued count, and clears the selection', async () => {
    post.mockResolvedValue({ data: { queued: [1, 2], skipped: [] } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleHelloFlex())
    expect(post).toHaveBeenCalledWith('/matches/bulk/couple', { match_ids: [1, 2], target: 'helloflex' })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(r.result.current.selectedIds.size).toBe(0)
  })

  // The endpoint's { queued, skipped } contract (a matrix block or an unknown/
  // other-tenant id is skipped, never a mid-batch 422) — a partial result must
  // read as partial, never as a plain "success" hiding the skip.
  it('reports a partial result honestly when some ids are skipped', async () => {
    post.mockResolvedValue({ data: { queued: [1], skipped: [2] } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleShiftmanager())
    expect(post).toHaveBeenCalledWith('/sync/matches/bulk', { ids: [1, 2], system: 'shiftmanager' })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', 'bulk.coupleQueuedPartial'))
    expect(notify).not.toHaveBeenCalledWith('success', expect.anything())
  })

  // HF-CONTRACTMAP-1: `skipped` may carry [{id, reason}] (e.g. a match whose
  // contract form has no HelloFlex GUID mapped yet) — the toast must show WHY,
  // not just a bare skipped count.
  it('shows a reasoned breakdown when skipped entries carry a reason', async () => {
    post.mockResolvedValue({ data: { queued: [1], skipped: [{ id: 2, reason: 'helloflex_contract_type_unmapped' }] } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleHelloFlex())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', 'bulk.coupleQueuedPartialReasoned'))
    expect(notify).not.toHaveBeenCalledWith('info', 'bulk.coupleQueuedPartial')
  })

  it('a 403 on the HelloFlex couple route reads the module-off toast, not the generic error', async () => {
    post.mockRejectedValue({ response: { status: 403 } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleHelloFlex())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.coupleModuleOff'))
    expect(notify).not.toHaveBeenCalledWith('error', 'bulk.mutateError')
  })

  it('a 403 on the Shiftmanager sync path stays the generic error', async () => {
    post.mockRejectedValue({ response: { status: 403 } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleShiftmanager())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
  })

  it('a 404 (endpoint not built yet) is treated as "not available", never a hard error', async () => {
    post.mockRejectedValue({ response: { status: 404 } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleShiftmanager())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', expect.any(String)))
  })

  it('a 503 (integration not configured) is also treated as "not available"', async () => {
    post.mockRejectedValue({ response: { status: 503 } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleHelloFlex())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', expect.any(String)))
  })

  it('any other failure surfaces the generic mutate error', async () => {
    post.mockRejectedValue({ response: { status: 500 } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleHelloFlex())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
  })
})
