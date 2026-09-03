/**
 * useWhatsAppQueue — the "Wachtrij" tab's 5s poll must stop hammering the
 * backend while the browser tab is hidden (scalability-2 audit finding),
 * mirroring useJobsList's `document.visibilityState === 'visible'` gate.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWhatsAppQueue } from './useWhatsAppQueue'
import type { WaQueueBatch } from '@/types/whatsapp'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'

const get = api.get as unknown as ReturnType<typeof vi.fn>

// An active batch (no finished_at, non-terminal status) so the poll interval starts.
const activeBatch: WaQueueBatch = { batch_id: 'b1', total: 10, queued: 5, status: 'sending' }

// Sets document.visibilityState (read-only DOM prop in jsdom) for one test.
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

beforeEach(() => {
  get.mockReset()
  vi.useFakeTimers()
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useWhatsAppQueue · visibility-gated polling', () => {
  it('does not call the API on a poll tick while the tab is hidden', async () => {
    get.mockResolvedValue({ data: [activeBatch] })
    renderHook(() => useWhatsAppQueue())
    await act(async () => { await vi.advanceTimersByTimeAsync(0) }) // flush the initial load()
    expect(get).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) }) // one poll tick
    expect(get).toHaveBeenCalledTimes(1) // still just the initial load, tick skipped
  })

  it('calls the API on a poll tick while the tab is visible', async () => {
    get.mockResolvedValue({ data: [activeBatch] })
    renderHook(() => useWhatsAppQueue())
    await act(async () => { await vi.advanceTimersByTimeAsync(0) }) // flush the initial load()
    expect(get).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) }) // one poll tick, still visible
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('stops polling once every batch has finished', async () => {
    get.mockResolvedValue({ data: [{ ...activeBatch, status: 'finished', finished_at: '2026-09-01T10:00:00Z' }] })
    const { result } = renderHook(() => useWhatsAppQueue())
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.loading).toBe(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(get).toHaveBeenCalledTimes(1) // no active batch → no interval was ever armed
  })
})
