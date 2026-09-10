/**
 * useGeocodePoll — GEO-POLL-1 regression: the poll keeps going past the old 11 s window
 * until the write lands, stops at its cap, resumes on mount while a request is open
 * (also under StrictMode), and a cancelled loop never reads again.
 */
import { StrictMode, createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGeocodePoll, isGeocodePending, GEOCODE_POLL_DELAYS_MS } from './useGeocodePoll'

const mockGet = vi.fn()
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: (...args: unknown[]) => mockGet(...args) },
}))

const empty = { lat: null, lng: null, geocode: null }
const landedBody = { lat: '52.09083', lng: '5.12222', geocode: { requested_at: '2026-09-10T10:27:32Z', requested_by: 'Danny', updated_at: '2026-09-10T10:27:48Z' } }
const pendingBody = { lat: null, lng: null, geocode: { requested_at: '2026-09-10T10:27:32Z', requested_by: 'Danny', updated_at: null } }

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useGeocodePoll', () => {
  it('keeps polling past 11 s and adopts the write when it lands at ~22 s (the measured 15 s run)', async () => {
    // Five empty reads (2+2+3+4+5 = 16 s), then the landed record on the sixth (22 s).
    mockGet.mockResolvedValue({ data: pendingBody })
    const onLanded = vi.fn()
    const { result } = renderHook(() => useGeocodePoll({ fetchEndpoint: '/candidates/1', base: empty, onLanded }))
    act(() => { result.current.start() })
    await act(async () => { await vi.advanceTimersByTimeAsync(11000) })
    expect(result.current.lat).toBeNull()
    expect(result.current.polling).toBe(true)
    mockGet.mockResolvedValue({ data: landedBody })
    await act(async () => { await vi.advanceTimersByTimeAsync(12000) })
    expect(result.current.lat).toBe(52.09083)
    expect(result.current.lng).toBe(5.12222)
    expect(result.current.geocode?.updatedAt).toBe('2026-09-10T10:27:48Z')
    expect(result.current.polling).toBe(false)
    expect(onLanded).toHaveBeenCalledTimes(1)
    expect(onLanded).toHaveBeenCalledWith({ lat: 52.09083, lng: 5.12222, geocode: { requestedAt: '2026-09-10T10:27:32Z', requestedBy: 'Danny', updatedAt: '2026-09-10T10:27:48Z' } })
    // No read after landing.
    const reads = mockGet.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
    expect(mockGet.mock.calls.length).toBe(reads)
  })

  it('stops at the cap without a landed write and never calls onLanded', async () => {
    mockGet.mockResolvedValue({ data: pendingBody })
    const onLanded = vi.fn()
    const { result } = renderHook(() => useGeocodePoll({ fetchEndpoint: '/customers/7', base: empty, onLanded }))
    act(() => { result.current.start() })
    const total = GEOCODE_POLL_DELAYS_MS.reduce((a, b) => a + b, 0)
    await act(async () => { await vi.advanceTimersByTimeAsync(total + 1000) })
    expect(mockGet).toHaveBeenCalledTimes(GEOCODE_POLL_DELAYS_MS.length)
    expect(onLanded).not.toHaveBeenCalled()
    expect(result.current.polling).toBe(false)
  })

  it('treats changed coordinates as landed when the record carries no provenance (customer, vacancy)', async () => {
    mockGet.mockResolvedValueOnce({ data: { lat: null, lng: null } }).mockResolvedValue({ data: { lat: '51.9', lng: '4.5' } })
    const onLanded = vi.fn()
    const { result } = renderHook(() => useGeocodePoll({ fetchEndpoint: '/vacancies/3', base: empty, onLanded }))
    act(() => { result.current.start() })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(result.current.lat).toBe(51.9)
    expect(onLanded).toHaveBeenCalledWith({ lat: 51.9, lng: 4.5, geocode: null })
    expect(result.current.polling).toBe(false)
  })

  it('resumes on mount while a request is still open, also under StrictMode', async () => {
    vi.setSystemTime(new Date('2026-09-10T10:28:00Z'))
    mockGet.mockResolvedValue({ data: landedBody })
    const onLanded = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
    const { result } = renderHook(
      () => useGeocodePoll({ fetchEndpoint: '/candidates/1', base: { lat: null, lng: null, geocode: { requestedAt: '2026-09-10T10:27:32Z', requestedBy: 'Danny', updatedAt: null } }, onLanded }),
      { wrapper },
    )
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(result.current.lat).toBe(52.09083)
    expect(onLanded).toHaveBeenCalledTimes(1)
  })

  it('does not resume a request that already landed or one older than the resume window', () => {
    vi.setSystemTime(new Date('2026-09-10T10:28:00Z'))
    expect(isGeocodePending({ requestedAt: '2026-09-10T10:27:32Z', requestedBy: 'Danny', updatedAt: '2026-09-10T10:27:48Z' })).toBe(false)
    expect(isGeocodePending({ requestedAt: '2026-09-10T09:00:00Z', requestedBy: 'Danny', updatedAt: null })).toBe(false)
    expect(isGeocodePending({ requestedAt: '2026-09-10T10:27:32Z', requestedBy: 'Danny', updatedAt: null })).toBe(true)
    expect(isGeocodePending(null)).toBe(false)
    renderHook(() => useGeocodePoll({ fetchEndpoint: '/candidates/1', base: { lat: null, lng: null, geocode: { requestedAt: '2026-09-10T09:00:00Z', requestedBy: 'Danny', updatedAt: null } } }))
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('never reads after unmount and never reads without a fetch route', async () => {
    mockGet.mockResolvedValue({ data: pendingBody })
    const { result, unmount } = renderHook(() => useGeocodePoll({ fetchEndpoint: '/candidates/1', base: empty }))
    act(() => { result.current.start() })
    await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
    expect(mockGet).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
    expect(mockGet).toHaveBeenCalledTimes(1)
    const noRoute = renderHook(() => useGeocodePoll({ fetchEndpoint: null, base: empty }))
    act(() => { noRoute.result.current.start() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
