import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Stub the tenant-aware api client so no real request runs (§mutation tests below
// assert the REQUEST route, per house rule).
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))

import api from '@/lib/api'
import { useCandidateSchedule } from './useCandidateSchedule'

const get = api.get as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { get.mockReset() })

describe('useCandidateSchedule', () => {
  it('renders the error state (not an empty list) when the agenda request fails', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/agenda')) return Promise.reject({ response: { status: 500 } })
      return Promise.resolve({ data: { data: [] } })
    })
    const r = renderHook(() => useCandidateSchedule('c1'))
    await waitFor(() => expect(r.result.current.rosterLoading).toBe(false))
    expect(r.result.current.rosterError).toBe(true)
    expect(r.result.current.roster).toEqual([])
  })

  it('renders the empty state (no error) for a genuinely empty agenda answer', async () => {
    get.mockResolvedValue({ data: { data: [] } })
    const r = renderHook(() => useCandidateSchedule('c1'))
    await waitFor(() => expect(r.result.current.rosterLoading).toBe(false))
    expect(r.result.current.rosterError).toBe(false)
    expect(r.result.current.roster).toEqual([])
  })

  it('retry re-fires the real /agenda request', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/agenda')) return Promise.reject({ response: { status: 500 } })
      return Promise.resolve({ data: { data: [] } })
    })
    const r = renderHook(() => useCandidateSchedule('c1'))
    await waitFor(() => expect(r.result.current.rosterLoading).toBe(false))
    const callsBefore = get.mock.calls.filter(([u]) => String(u).includes('/agenda')).length
    get.mockImplementation((url: string) => {
      if (url.includes('/agenda')) return Promise.resolve({ data: { data: [{ id: 1, customer: 'Acme' }] } })
      return Promise.resolve({ data: { data: [] } })
    })
    act(() => { r.result.current.reloadRoster() })
    await waitFor(() => expect(r.result.current.roster).toHaveLength(1))
    const callsAfter = get.mock.calls.filter(([u]) => String(u).includes('/agenda')).length
    expect(callsAfter).toBeGreaterThan(callsBefore)
    expect(r.result.current.rosterError).toBe(false)
  })

  // DRY (CANDHOOKS r10): exercises the shared useScheduleLoadState factory's own
  // dependency array (candidateId/path/locale/attempt/mapRows) directly — a
  // candidateId change must fire a NEW request at the new candidate's route AND
  // apply the (now module-level, stable) mapper to that new response, proving the
  // exhaustive-deps fix (mapRows added to the effect's deps) never causes a stale
  // fetch, an infinite refetch loop, or a stale mapper to linger.
  it('re-fetches the new candidate\'s agenda and re-maps its rows when candidateId changes', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/c1/agenda')) return Promise.resolve({ data: { data: [{ id: 1, customer: 'Acme' }] } })
      if (url.includes('/c2/agenda')) return Promise.resolve({ data: { data: [{ id: 2, customer: 'Beta' }] } })
      return Promise.resolve({ data: { data: [] } })
    })
    const r = renderHook(({ id }: { id: string }) => useCandidateSchedule(id), { initialProps: { id: 'c1' } })
    await waitFor(() => expect(r.result.current.rosterLoading).toBe(false))
    expect(r.result.current.roster[0].client).toBe('Acme')
    const callsBefore = get.mock.calls.filter(([u]) => String(u).includes('/agenda')).length
    r.rerender({ id: 'c2' })
    await waitFor(() => expect(r.result.current.roster[0]?.client).toBe('Beta'))
    const callsAfter = get.mock.calls.filter(([u]) => String(u).includes('/agenda')).length
    // Exactly one extra request for the id change — never an infinite loop from a
    // mismatched mapper identity re-triggering the effect on every render.
    expect(callsAfter).toBe(callsBefore + 1)
    // The open-shifts source shares the same candidateId and refetches independently
    // (own effect) — assert the agenda call happened somewhere in the log, not that
    // it was necessarily the LAST get() call overall.
    expect(get.mock.calls.some(([u]) => String(u).includes('/c2/agenda'))).toBe(true)
  })

  it('one failing source does not blank the other', async () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/agenda')) return Promise.reject({ response: { status: 500 } })
      if (url.includes('/open-shifts')) return Promise.resolve({ data: { data: [{ id: 9, customer: 'Beta' }] } })
      return Promise.reject(new Error('unexpected url'))
    })
    const r = renderHook(() => useCandidateSchedule('c1'))
    await waitFor(() => expect(r.result.current.rosterLoading).toBe(false))
    await waitFor(() => expect(r.result.current.openShiftsLoading).toBe(false))
    expect(r.result.current.rosterError).toBe(true)
    expect(r.result.current.roster).toEqual([])
    expect(r.result.current.openShiftsError).toBe(false)
    expect(r.result.current.openShifts).toHaveLength(1)
  })
})
