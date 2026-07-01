import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Stub the tenant-aware api client + toast so no real request/toast runs.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  unwrapList: (r: { data?: unknown }) => ({ rows: Array.isArray(r?.data) ? r.data : [] }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useCandidatePlanningPreferences, useCandidateAvailability } from './useCandidatePlanning'

const get    = api.get    as unknown as ReturnType<typeof vi.fn>
const post   = api.post   as unknown as ReturnType<typeof vi.fn>
const del    = api.delete as unknown as ReturnType<typeof vi.fn>
const notify = notifyError as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { get.mockReset(); post.mockReset(); del.mockReset(); notify.mockClear() })

describe('useCandidatePlanningPreferences', () => {
  it('loads and splits favourites from blacklist', async () => {
    get.mockResolvedValue({ data: [
      { id: 1, kind: 'favorite',  linkable_type: 'customer', linkable_id: 10, linkable_name: 'Thuiszorg' },
      { id: 2, kind: 'blacklist', linkable_type: 'location', linkable_id: 20, linkable_name: 'Haarlem' },
    ] })
    const r = renderHook(() => useCandidatePlanningPreferences('c1'))
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    expect(r.result.current.favorites).toHaveLength(1)
    expect(r.result.current.blacklist).toHaveLength(1)
    expect(r.result.current.favorites[0].linkable_name).toBe('Thuiszorg')
  })

  it('adds optimistically and reconciles with the server row', async () => {
    get.mockResolvedValue({ data: [] })
    post.mockResolvedValue({ data: { id: 99, kind: 'favorite', linkable_type: 'customer', linkable_id: 10, linkable_name: 'Thuiszorg' } })
    const r = renderHook(() => useCandidatePlanningPreferences('c1'))
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.add('favorite', { linkable_type: 'customer', linkable_id: 10, linkable_name: 'Thuiszorg' }) })
    expect(r.result.current.favorites).toHaveLength(1)
    expect(r.result.current.favorites[0].id).toBe(99)   // temp id replaced by server id
  })

  it('rolls back and toasts on a 409 duplicate', async () => {
    get.mockResolvedValue({ data: [] })
    post.mockRejectedValue({ response: { status: 409 } })
    const r = renderHook(() => useCandidatePlanningPreferences('c1'))
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.add('blacklist', { linkable_type: 'customer', linkable_id: 10, linkable_name: 'X' }) })
    expect(r.result.current.blacklist).toHaveLength(0)
    expect(notify).toHaveBeenCalledWith('planning.prefDuplicate')
  })

  it('removes optimistically and restores the row on failure', async () => {
    get.mockResolvedValue({ data: [{ id: 5, kind: 'favorite', linkable_type: 'customer', linkable_id: 1, linkable_name: 'A' }] })
    del.mockRejectedValue({ response: { status: 500 } })
    const r = renderHook(() => useCandidatePlanningPreferences('c1'))
    await waitFor(() => expect(r.result.current.favorites).toHaveLength(1))
    await act(async () => { await r.result.current.remove(5) })
    expect(r.result.current.favorites).toHaveLength(1)          // restored
    expect(notify).toHaveBeenCalledWith('common:actionFailed')
  })
})

describe('useCandidateAvailability', () => {
  it('loads entries and normalises the day-part + status', async () => {
    get.mockResolvedValue({ data: [{ id: 1, date: '2026-07-01', part: 'morning', status: 'unavailable', reason: 'vakantie' }] })
    const r = renderHook(() => useCandidateAvailability('c1'))
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    expect(r.result.current.entries[0].part).toBe('morning')
    expect(r.result.current.entries[0].status).toBe('unavailable')
  })

  it('rolls back and toasts on a 409 duplicate slot', async () => {
    get.mockResolvedValue({ data: [] })
    post.mockRejectedValue({ response: { status: 409 } })
    const r = renderHook(() => useCandidateAvailability('c1'))
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.add({ date: '2026-07-01', part: 'day', status: 'unavailable' }) })
    expect(r.result.current.entries).toHaveLength(0)
    expect(notify).toHaveBeenCalledWith('planning.availDuplicate')
  })
})
