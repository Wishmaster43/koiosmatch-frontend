/**
 * useDeletionLifecycle (TRASH-OVERAL-2) — asserts the REQUESTS (§13: method/route/
 * body, never only that a callback fired): the preview GET route, mark POST with
 * {transfer_to_owner_id} when given and an EMPTY body when not, the 409 in_use
 * outcome ({blocked:true} + refreshed blocking, no raw throw), the unmark POST
 * route, and the shared grace-days lookup + eraseAroundDate helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { useDeletionLifecycle, eraseAroundDate, __resetDeletionGraceCache, type MarkDeletionResult } from './useDeletionLifecycle'

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

const PREVIEW = {
  blocking: [{ type: 'matches', label: 'Matches', count: 2 }],
  transferable: { attribute: 'owner_id', current_owner_id: 'u-1' },
  can_mark: false,
  lifecycle: 'active',
}

// Default GET routing: the entity preview + the shared /settings grace lookup.
function mockGets({ preview = PREVIEW, settings = { deletion_grace_days: '30' } as Record<string, string> } = {}) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/settings') return Promise.resolve({ data: settings })
    return Promise.resolve({ data: { data: preview } })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetDeletionGraceCache()
  mockGets()
  vi.mocked(api.post).mockResolvedValue({ data: { data: { lifecycle: 'pending_erase' } } })
})

describe('useDeletionLifecycle — preview', () => {
  it('GETs /{entity}/{id}/deletion-preview and exposes the unwrapped preview', async () => {
    const { result } = renderHook(() => useDeletionLifecycle('customers', 'abc-1'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/abc-1/deletion-preview'))
    await waitFor(() => expect(result.current.preview).toEqual(PREVIEW))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('does not fetch without an id and reports error on a failed GET', async () => {
    const { result } = renderHook(() => useDeletionLifecycle('customers', null))
    expect(result.current.loading).toBe(false)
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('deletion-preview'))

    vi.mocked(api.get).mockImplementation((url: string) => url === '/settings'
      ? Promise.resolve({ data: {} })
      : Promise.reject(new Error('boom')))
    const failed = renderHook(() => useDeletionLifecycle('customers', 'abc-2'))
    await waitFor(() => expect(failed.result.current.error).toBe(true))
    expect(failed.result.current.loading).toBe(false)
  })
})

describe('useDeletionLifecycle — mark', () => {
  it('POSTs mark-deletion with {transfer_to_owner_id} when a transfer target is given', async () => {
    const { result } = renderHook(() => useDeletionLifecycle('customers', 'abc-1'))
    await waitFor(() => expect(result.current.preview).not.toBeNull())

    await act(async () => { await result.current.mark('u-9') })
    expect(api.post).toHaveBeenCalledWith('/customers/abc-1/mark-deletion',
      { transfer_to_owner_id: 'u-9' }, { quietStatuses: [409] })
  })

  it('POSTs mark-deletion with an EMPTY body when no transfer target is given', async () => {
    const { result } = renderHook(() => useDeletionLifecycle('customers', 'abc-1'))
    await waitFor(() => expect(result.current.preview).not.toBeNull())

    let outcome: MarkDeletionResult | undefined
    await act(async () => { outcome = await result.current.mark() })
    expect(api.post).toHaveBeenCalledWith('/customers/abc-1/mark-deletion', {}, { quietStatuses: [409] })
    expect(outcome).toEqual({ blocked: false, blocking: [] })
    // Success reflects locally: the row is now parked in the trash.
    expect(result.current.preview?.lifecycle).toBe('pending_erase')
  })

  it('turns a 409 in_use into {blocked:true} + a refreshed blocking list, never a raw throw', async () => {
    const fresh = [{ type: 'open_tasks', label: 'Open taken', count: 3 }]
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { code: 'in_use', blocking: fresh } } })
    const { result } = renderHook(() => useDeletionLifecycle('customers', 'abc-1'))
    await waitFor(() => expect(result.current.preview).not.toBeNull())

    let outcome: MarkDeletionResult | undefined
    await act(async () => { outcome = await result.current.mark('u-9') })
    expect(outcome).toEqual({ blocked: true, blocking: fresh })
    // The local preview mirrors the server truth: blocked, with the fresh list.
    expect(result.current.preview?.blocking).toEqual(fresh)
    expect(result.current.preview?.can_mark).toBe(false)
  })

  it('rethrows non-409 failures for the caller to handle', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useDeletionLifecycle('customers', 'abc-1'))
    await waitFor(() => expect(result.current.preview).not.toBeNull())

    await expect(result.current.mark()).rejects.toEqual({ response: { status: 500 } })
  })
})

describe('useDeletionLifecycle — unmark', () => {
  it('POSTs unmark-deletion and drops the local lifecycle back to archived', async () => {
    const { result } = renderHook(() => useDeletionLifecycle('workflows', 'wf-1'))
    await waitFor(() => expect(result.current.preview).not.toBeNull())

    await act(async () => { await result.current.unmark() })
    expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/unmark-deletion')
    expect(result.current.preview?.lifecycle).toBe('archived')
  })
})

describe('useDeletionLifecycle — grace window', () => {
  it('reads deletion_grace_days once via GET /settings (shared promise cache)', async () => {
    const a = renderHook(() => useDeletionLifecycle('customers', 'abc-1'))
    const b = renderHook(() => useDeletionLifecycle('customers', 'abc-2'))
    await waitFor(() => expect(a.result.current.graceDays).toBe(30))
    await waitFor(() => expect(b.result.current.graceDays).toBe(30))
    expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === '/settings')).toHaveLength(1)
  })

  it('falls back to null when the key is absent (never fabricate a date)', async () => {
    mockGets({ settings: {} })
    const { result } = renderHook(() => useDeletionLifecycle('customers', 'abc-1'))
    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(result.current.graceDays).toBeNull()
  })
})

describe('eraseAroundDate', () => {
  it('adds the grace window to pending_erase_at', () => {
    const d = eraseAroundDate('2026-08-01T10:00:00Z', 30)
    expect(d).toBeInstanceOf(Date)
    expect(d?.getTime()).toBe(new Date('2026-08-31T10:00:00Z').getTime())
  })

  it('is null for a missing stamp, unknown grace, or unparseable date', () => {
    expect(eraseAroundDate(null, 30)).toBeNull()
    expect(eraseAroundDate('2026-08-01T10:00:00Z', null)).toBeNull()
    expect(eraseAroundDate('not-a-date', 30)).toBeNull()
  })
})
