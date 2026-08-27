/**
 * useMatchContract — regression tests for the load-bearing rules:
 * (1) loads the contract/financial layer via GET /matches/{id} on mount;
 * (2) save() applies optimistically, then merges the server's echoed row
 *     (margin/approval_status recomputed);
 * (3) a failed save REVERTS to the last confirmed values and rethrows so the
 *     caller can surface the server's message (422/409).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchContract } from './useMatchContract'
import api from '@/lib/api'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
const mockedGet   = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)

afterEach(() => vi.clearAllMocks())

const detailRow = {
  function_title: 'Verpleegkundige', contract_type: 'ZZP Flex', start_date: '2026-01-01', end_date: null, hours_per_week: 32,
  cao: 'vvt', scale: '', step: '', surcharge: 15, purchase_rate: 28.5, sell_rate: 41.75,
  cost_center: 'KP-1', billing_emails: ['a@example.org'], remarks: '', margin: 13.25,
}

describe('useMatchContract', () => {
  it('loads the contract layer for the given match on mount', async () => {
    mockedGet.mockResolvedValue({ data: { data: detailRow } })
    const { result } = renderHook(() => useMatchContract('m1'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/matches/m1')
    expect(result.current.data.purchase_rate).toBe(28.5)
    expect(result.current.data.billing_emails).toEqual(['a@example.org'])
    expect(result.current.data.function_title).toBe('Verpleegkundige')
    expect(result.current.data.surcharge).toBe(15)
    expect(result.current.error).toBe(false)
  })

  it('flags the error state when the detail fetch fails', async () => {
    mockedGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useMatchContract('m1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.unavailable).toBe(false)
  })

  it('treats a 503 as "unavailable" (integration not configured), not a hard error', async () => {
    mockedGet.mockRejectedValue({ response: { status: 503 } })
    const { result } = renderHook(() => useMatchContract('m1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.unavailable).toBe(true)
    expect(result.current.error).toBe(false)
  })

  it('saves optimistically and merges the recomputed margin/approval back', async () => {
    mockedGet.mockResolvedValue({ data: { data: detailRow } })
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useMatchContract('m1', onUpdate))
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockedPatch.mockResolvedValue({
      data: { data: { ...detailRow, sell_rate: 50, margin: 21.5, approval_status: 'pending' } },
    })
    await act(async () => { await result.current.save({ sell_rate: 50 }) })

    expect(mockedPatch).toHaveBeenCalledWith('/matches/m1', { sell_rate: 50 })
    expect(result.current.data.sell_rate).toBe(50)
    expect(result.current.data.margin).toBe(21.5)
    // A rate edit can re-open approval BE-side — the echoed status bubbles to the page.
    expect(onUpdate).toHaveBeenCalledWith('m1', { approval_status: 'pending', approval_rejected_reason: '' })
  })

  it('flags matchTextPresent when the payload carries the description key, even when null (M17 OFFERED-IFF-READ)', async () => {
    mockedGet.mockResolvedValue({ data: { data: { ...detailRow, description: null } } })
    const { result } = renderHook(() => useMatchContract('m1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.matchTextPresent).toBe(true)
    expect(result.current.data.description).toBeNull()
  })

  it('flags matchTextPresent false when the backend payload does not carry the description key at all', async () => {
    mockedGet.mockResolvedValue({ data: { data: detailRow } })
    const { result } = renderHook(() => useMatchContract('m1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.matchTextPresent).toBe(false)
  })

  // TARIEF-ZIJDE-1 (Danny 15-08): a gated CONTRACTREGELS line arrives with
  // `rate: null` from MatchDetailResource::visibleContractLines — `pick()` must
  // preserve that null (never coerce it to 0/NaN) while still mapping the
  // function title and sort order, which are never gated.
  it('preserves a gated rate line as null, and always maps function title + order', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          ...detailRow,
          contract_lines: [
            { id: 'l1', function_title: 'Verpleegkundige', rate: null, sort_order: 0 },
            { id: 'l2', function_title: 'Helpende', rate: '24.50', sort_order: 1 },
          ],
        },
      },
    })
    const { result } = renderHook(() => useMatchContract('m1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data.contractLines).toEqual([
      { id: 'l1', functionTitle: 'Verpleegkundige', rate: null, sortOrder: 0 },
      { id: 'l2', functionTitle: 'Helpende', rate: 24.5, sortOrder: 1 },
    ])
  })

  it('reverts to the last confirmed values and rethrows on a failed save', async () => {
    mockedGet.mockResolvedValue({ data: { data: detailRow } })
    const { result } = renderHook(() => useMatchContract('m1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const serverError = { response: { status: 422, data: { message: 'The sell rate must be at least 0.' } } }
    mockedPatch.mockRejectedValue(serverError)

    const revertBefore = result.current.revertTick
    // Catch INSIDE the act callback (rather than letting it reject act()'s own
    // promise) so React fully flushes the catch block's setState calls before
    // we assert — a throw propagating out of an async act() callback can race
    // React's own update flush.
    let caught: unknown
    await act(async () => {
      try { await result.current.save({ sell_rate: -5 }) } catch (e) { caught = e }
    })

    expect(caught).toEqual(serverError)
    // Reverted to the pre-save value, and the remount tick bumped so the
    // (uncontrolled) EditableFieldTable re-seeds from the reverted data.
    expect(result.current.data.sell_rate).toBe(41.75)
    expect(result.current.revertTick).toBe(revertBefore + 1)
  })
})
