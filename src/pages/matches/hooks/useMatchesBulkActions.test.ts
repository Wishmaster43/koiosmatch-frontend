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

describe('useMatchesBulkActions · bulkCouple', () => {
  it('posts the selection + target, reports the `queued` count, and clears the selection', async () => {
    post.mockResolvedValue({ data: { queued: [1] } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleHelloFlex())
    expect(post).toHaveBeenCalledWith('/matches/bulk/couple', { match_ids: [1, 2], target: 'helloflex' })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(r.result.current.selectedIds.size).toBe(0)
  })

  it('falls back to the `updated` list\'s length when `queued` is absent', async () => {
    post.mockResolvedValue({ data: { updated: [1, 2] } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleShiftManager())
    expect(post).toHaveBeenCalledWith('/matches/bulk/couple', { match_ids: [1, 2], target: 'shiftmanager' })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
  })

  it('a 404 (endpoint not built yet) is treated as "not available", never a hard error', async () => {
    post.mockRejectedValue({ response: { status: 404 } })
    const r = harness()
    act(() => r.result.current.actions.bulkCoupleShiftManager())
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
