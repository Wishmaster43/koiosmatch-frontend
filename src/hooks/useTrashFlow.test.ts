/**
 * useTrashFlow (TRASH-OVERAL-2) — asserts the REQUESTS per entity path (§13:
 * method/route/body, never only that a callback fired): the preview GET on open,
 * the mark POST on confirm (matches + workflows, the two no-transfer entities of
 * this lane), the unmark POST for all three lane entities, the 409 in_use outcome
 * (modal stays open, blocked flag set, list NOT refreshed) and the composed
 * trash note (DD-MM-YYYY wording, honest fallback without a grace window).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { __resetDeletionGraceCache } from '@/hooks/useDeletionLifecycle'
import { useTrashFlow, buildTrashNote } from './useTrashFlow'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  // settingsApi's cache-invalidation imports reach this too (tenant-keyed caches).
  getActiveTenantId: () => null,
  // Minimal stand-in for the shared adapter: unwrap a { data: { data } } resource.
  unwrap: (res: { data?: unknown }) => {
    const body = res?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

import { notifyError, notifySuccess } from '@/lib/notify'

const PREVIEW = { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' }

beforeEach(() => {
  vi.clearAllMocks()
  __resetDeletionGraceCache()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/settings') return Promise.resolve({ data: { deletion_grace_days: '30' } })
    return Promise.resolve({ data: { data: PREVIEW } })
  })
  vi.mocked(api.post).mockResolvedValue({ data: { data: { lifecycle: 'pending_erase' } } })
})

describe('useTrashFlow · mark (matches)', () => {
  it('opening fetches the preview and confirm POSTs /matches/{id}/mark-deletion with an empty body', async () => {
    const onMarked = vi.fn()
    const { result } = renderHook(() => useTrashFlow({ entityPath: 'matches', onMarked }))
    act(() => { result.current.openFor('m1', 'Jane — Verpleegkundige') })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/matches/m1/deletion-preview'))

    await act(async () => { await result.current.confirmMark(null) })
    // No transfer picked → an EMPTY body, never transfer_to_owner_id: null.
    expect(api.post).toHaveBeenCalledWith('/matches/m1/mark-deletion', {}, expect.anything())
    expect(onMarked).toHaveBeenCalledWith('m1')
    // Success feedback is the shared trash.marked toast (uniform across all seven entities).
    expect(notifySuccess).toHaveBeenCalled()
    expect(result.current.target).toBeNull()
  })

  it('a 409 in_use keeps the modal open, flags blocked and does NOT refresh the list', async () => {
    const onMarked = vi.fn()
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { code: 'in_use', blocking: [{ type: 'contract', label: 'Contract', count: 1 }] } } })
    const { result } = renderHook(() => useTrashFlow({ entityPath: 'matches', onMarked }))
    act(() => { result.current.openFor('m1', 'Jane') })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.confirmMark(null) })
    expect(result.current.blocked).toBe(true)
    expect(result.current.target).not.toBeNull()
    expect(onMarked).not.toHaveBeenCalled()
  })

  it('a non-409 failure surfaces the shared failure toast (never a silent drop)', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useTrashFlow({ entityPath: 'matches' }))
    act(() => { result.current.openFor('m1', 'Jane') })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.confirmMark(null) })
    expect(notifyError).toHaveBeenCalled()
  })
})

describe('useTrashFlow · mark (workflows)', () => {
  it('confirm POSTs /workflows/{id}/mark-deletion', async () => {
    const { result } = renderHook(() => useTrashFlow({ entityPath: 'workflows' }))
    act(() => { result.current.openFor('wf-1', 'Welcome flow') })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflows/wf-1/deletion-preview'))
    await act(async () => { await result.current.confirmMark(null) })
    expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/mark-deletion', {}, expect.anything())
  })
})

describe('useTrashFlow · unmark', () => {
  it.each([
    ['matches', 'm1'],
    ['outreach-campaigns', 'c1'],
    ['workflows', 'wf-1'],
  ])('POSTs /%s/{id}/unmark-deletion and reports the id back', async (entityPath, id) => {
    const onUnmarked = vi.fn()
    const { result } = renderHook(() => useTrashFlow({ entityPath, onUnmarked }))
    await act(async () => { await result.current.unmark(id) })
    expect(api.post).toHaveBeenCalledWith(`/${entityPath}/${id}/unmark-deletion`)
    expect(onUnmarked).toHaveBeenCalledWith(id)
    // Success feedback is the shared trash.unmarked toast.
    expect(notifySuccess).toHaveBeenCalled()
  })

  it('surfaces the failure toast and skips the refresh when the POST rejects', async () => {
    const onUnmarked = vi.fn()
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useTrashFlow({ entityPath: 'matches', onUnmarked }))
    await act(async () => { await result.current.unmark('m1') })
    expect(onUnmarked).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalled()
  })
})

describe('buildTrashNote', () => {
  // Fake t/formatDate: the note's SHAPE is under test, not the locale copy.
  const t = (key: string, opts?: Record<string, unknown>) => `${key}:${opts?.date ?? ''}`
  const formatDate = (d?: string | Date | null) => {
    const dd = d instanceof Date ? d : new Date(String(d))
    return `${String(dd.getDate()).padStart(2, '0')}-${String(dd.getMonth() + 1).padStart(2, '0')}-${dd.getFullYear()}`
  }

  it('joins the pending-since line with the projected erase moment (DD-MM-YYYY)', () => {
    // Mid-day timestamp so the local-time date is stable across test-runner timezones.
    const note = buildTrashNote(t, formatDate, '2026-08-01T12:00:00Z', 30)
    expect(note).toContain('common:trash.pendingSince:01-08-2026')
    expect(note).toContain('common:trash.eraseAround:31-08-2026')
  })

  it('falls back to the neutral wording when the grace window is unknown', () => {
    const note = buildTrashNote(t, formatDate, '2026-08-01T12:00:00Z', null)
    expect(note).toContain('common:trash.eraseAutomatic')
    expect(note).not.toContain('eraseAround')
  })
})
