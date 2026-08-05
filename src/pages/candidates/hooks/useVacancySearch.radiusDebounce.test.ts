/**
 * useVacancySearch — radius→fetch debounce regression (Danny 06-08 network-tab
 * feedback): dragging the radius slider used to fire ONE request PER TICK (radius
 * 65, 70, 75… each cancelling the previous — dozens of cancelled XHRs per drag).
 * The fetch now waits RADIUS_DEBOUNCE_MS for the value to settle; the LIVE
 * radiusKm returned to the slider/map must keep updating on every set() regardless.
 * Other filter changes (status/function/contractvorm — discrete clicks, not a
 * drag) are proven to still fire immediately, un-debounced.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVacancySearch } from './useVacancySearch'
import api from '@/lib/api'
import type { Candidate } from '@/types/candidate'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Minimal tenant-lookup stubs — this suite only cares about the radius/fetch timing,
// not the contract-form/status/function seeding logic (covered in VacancySearchTab.test.tsx).
/* eslint-disable no-restricted-syntax -- seed DATA mirroring the tenant lookup defaults, not a UI colour choice */
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ statuses: [{ value: 'open', label: 'Open', color: '#79B58E' }], statusMeta: () => ({ value: 'open', label: 'Open', color: '#79B58E' }) }),
}))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ candidateTypes: [], typeMeta: (v?: string | null) => ({ value: v ?? '', label: v ?? '', color: '#6B7280' }) }),
}))
/* eslint-enable no-restricted-syntax */
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => ({}) }
})

const candidate = { id: 'cand1', lat: 52.09, lng: 5.12, title: '', candidateTypes: [], preferences: {} } as unknown as Candidate

beforeEach(() => {
  vi.useFakeTimers()
  mockGet.mockReset()
  mockGet.mockResolvedValue({ data: { data: [] } })
})
afterEach(() => { vi.useRealTimers() })

describe('useVacancySearch · radius fetch debounce', () => {
  it('fires ONE request for a burst of radius changes, carrying the FINAL value', async () => {
    const { result } = renderHook(() => useVacancySearch(candidate))
    // Let the initial mount fetch (radius=30, the calm fallback) settle, then clear it.
    await act(async () => { await Promise.resolve() })
    mockGet.mockClear()

    // Simulate a slider drag: rapid ticks, each well under the debounce window.
    act(() => { result.current.setRadiusKm(65) })
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { result.current.setRadiusKm(70) })
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { result.current.setRadiusKm(75) })

    // The LIVE value (slider/map binding) already followed — no request fired yet.
    expect(result.current.radiusKm).toBe(75)
    expect(mockGet).not.toHaveBeenCalled()

    // Past the settle window — exactly ONE request, using the FINAL radius.
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', expect.objectContaining({
      params: expect.objectContaining({ radius: 75 }),
    }))
  })

  it('a discrete status toggle still fires immediately, without waiting for the radius debounce', async () => {
    const { result } = renderHook(() => useVacancySearch(candidate))
    await act(async () => { await Promise.resolve() })
    mockGet.mockClear()

    act(() => { result.current.setStatuses(['open', 'closed']) })
    await act(async () => { await Promise.resolve() })

    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('a candidate switch settles the radius immediately (no artificial delay on the new candidate\'s first fetch)', async () => {
    const { rerender } = renderHook(({ c }: { c: Candidate }) => useVacancySearch(c), { initialProps: { c: candidate } })
    await act(async () => { await Promise.resolve() })
    mockGet.mockClear()

    const otherCandidate = { ...candidate, id: 'cand2', preferences: { max_travel_km: 50 } } as unknown as Candidate
    rerender({ c: otherCandidate })
    // No timer advance at all — the switch itself is not a drag, so it must not wait.
    await act(async () => { await Promise.resolve() })

    expect(mockGet).toHaveBeenCalledWith('/candidates/cand2/vacancy-matches', expect.objectContaining({
      params: expect.objectContaining({ radius: 50 }),
    }))
  })
})
