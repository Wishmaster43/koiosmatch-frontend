/**
 * useCandidateAsyncBulk · bulkGeocode — 18-hygiene (2026-08-14): the endpoint should
 * only be asked to re-geocode rows that are actually missing coordinates, not the
 * whole selection. §13: the POST body is asserted, never only that a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useCandidateAsyncBulk } from './useCandidateAsyncBulk'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    isServiceUnavailable: () => false,
  } }
})

beforeEach(() => { vi.mocked(api.post).mockClear() })

// Minimal candidate rows: c1 has coordinates, c2/c3 do not.
const candidates = [
  { id: 'c1', lat: 52.1, lng: 5.1 },
  { id: 'c2', lat: null, lng: null },
  { id: 'c3', lat: null, lng: 5.1 },
] as unknown as Candidate[]

describe('useCandidateAsyncBulk · bulkGeocode', () => {
  it('posts only the ids missing lat/lng, not the full selection', () => {
    const setSelectedIds = vi.fn()
    const { result } = renderHook(() => useCandidateAsyncBulk({
      selectedIds: new Set(['c1', 'c2', 'c3']),
      setSelectedIds,
      notify: vi.fn(),
      t: ((k: string) => k) as unknown as import('i18next').TFunction,
      candidates,
    }))
    act(() => { result.current.bulkGeocode() })
    expect(api.post).toHaveBeenCalledWith('/candidates/bulk/geocode', { candidate_ids: ['c2', 'c3'] })
  })

  it('does nothing when every selected candidate already has coordinates', () => {
    const setSelectedIds = vi.fn()
    const { result } = renderHook(() => useCandidateAsyncBulk({
      selectedIds: new Set(['c1']),
      setSelectedIds,
      notify: vi.fn(),
      t: ((k: string) => k) as unknown as import('i18next').TFunction,
      candidates,
    }))
    act(() => { result.current.bulkGeocode() })
    expect(api.post).not.toHaveBeenCalled()
  })
})
