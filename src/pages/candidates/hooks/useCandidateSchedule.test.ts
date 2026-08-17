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
