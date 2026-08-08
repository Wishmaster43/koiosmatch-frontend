/**
 * useCandidateFilters — the request-shape unit tests for the candidates
 * right-panel filter picker (measured 2026-08-08: CandidatesPage already wires
 * this via useRightPanel/buildCandidateFilterGroups, composing with the
 * existing KPI-click/quick-view state in the SAME filterParams object built
 * here — never a second competing mechanism). §13: assert the REQUEST SHAPE
 * (filterParams), never just that a setter fired. Every key below is verified
 * against the backend's CandidateQuery::rules()/ARRAY_FILTERS
 * (koiosmatch-api/app/Services/Candidate/CandidateQuery.php).
 *
 * "Lands in the GET params for list AND stats": useCandidatesData.ts (read,
 * not owned by this task) passes this exact `filterParams` object, unmodified,
 * as the `params` of BOTH the list call (`api.get('/candidates', { params: {
 * ...filterParams, page, per_page } })`) and the stats call
 * (`heavyGet('/candidates/stats', { params: filterParams })`) — same
 * reference, no per-endpoint transform — so pinning the shape produced here
 * pins both requests at once.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

// usePageMemory persists in a module-level Map keyed by string, so a real
// import would leak filter state across the `it()`s in this file (mirrors
// useApplicationFilters.test.ts) — stub it as a plain useState, same contract.
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_key: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))

// geocodeNL hits the public PDOK API over fetch — stub it so the geo-radius
// test stays hermetic and deterministic.
vi.mock('@/lib/geocode', () => ({
  geocodeNL: vi.fn(async (q: string) =>
    q === 'nowhere' ? null : { lat: 52.1, lng: 5.1, label: 'Utrecht' }),
}))

import { useCandidateFilters } from './useCandidateFilters'

const t = (k: string) => k
const baseArgs = {
  t, staleMonths: 6, view: 'table' as const,
  mapCenter: { lat: 52.09, lng: 5.12 }, mapRadius: 30,
  setMapCenter: () => {}, setMapRadius: () => {},
}

describe('useCandidateFilters — categorical multi-select filters land in filterParams', () => {
  it('sends no categorical filter by default', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    expect(result.current.filterParams.status).toBeUndefined()
    expect(result.current.filterParams.phase).toBeUndefined()
    expect(result.current.filterParams.funnel_type).toBeUndefined()
    expect(result.current.filterParams.candidate_type).toBeUndefined()
    expect(result.current.filterParams.owner_id).toBeUndefined()
    expect(result.current.filterParams.gender).toBeUndefined()
    expect(result.current.filterParams.province).toBeUndefined()
    expect(result.current.filterParams.function_title).toBeUndefined()
    expect(result.current.filterParams.location_id).toBeUndefined()
    expect(result.current.filterParams.pool).toBeUndefined()
    expect(result.current.filterParams.city).toBeUndefined()
    expect(result.current.filterParams.source).toBeUndefined()
  })

  it('sends status as the full array (deployability axis)', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedStatus(['available', 'placed']) })
    expect(result.current.filterParams.status).toEqual(['available', 'placed'])
  })

  it('sends phase as the full array (lifecycle axis, PHASE-FILTER-1)', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedPhase(['lead', 'candidate']) })
    expect(result.current.filterParams.phase).toEqual(['lead', 'candidate'])
  })

  it('sends funnel_type as the full array (per-application stage)', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedFunnel(['applied', 'proposed']) })
    expect(result.current.filterParams.funnel_type).toEqual(['applied', 'proposed'])
  })

  it('sends candidate_type as the full array (contract form / Contractvorm)', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedType(['secondment', 'zzp']) })
    expect(result.current.filterParams.candidate_type).toEqual(['secondment', 'zzp'])
  })

  it('sends owner_id as the full array', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedOwner(['u1', 'u2']) })
    expect(result.current.filterParams.owner_id).toEqual(['u1', 'u2'])
  })

  it('sends location_id as the full array (branch)', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedLocation(['loc1']) })
    expect(result.current.filterParams.location_id).toEqual(['loc1'])
  })

  it('sends gender as the full array', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedGeslacht(['female']) })
    expect(result.current.filterParams.gender).toEqual(['female'])
  })

  it('sends province as the full array', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedProvince(['Utrecht', 'Gelderland']) })
    expect(result.current.filterParams.province).toEqual(['Utrecht', 'Gelderland'])
  })

  it('sends function_title as the full array (qualifications: function)', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedTitle(['Verpleegkundige']) })
    expect(result.current.filterParams.function_title).toEqual(['Verpleegkundige'])
  })

  it('sends pool as the full array', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedPool(['p1', 'p2']) })
    expect(result.current.filterParams.pool).toEqual(['p1', 'p2'])
  })

  it('sends city as the full array', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedCity(['Utrecht']) })
    expect(result.current.filterParams.city).toEqual(['Utrecht'])
  })

  it('sends source as the full array', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setSelectedSource(['referral', 'job-board']) })
    expect(result.current.filterParams.source).toEqual(['referral', 'job-board'])
  })
})

describe('useCandidateFilters — archived/trash view toggles include_archived', () => {
  it('sends no include_archived by default', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    expect(result.current.filterParams.include_archived).toBeUndefined()
  })

  it('sends include_archived=1 once the archived quick-view is toggled on', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setShowArchived(true) })
    expect(result.current.filterParams.include_archived).toBe(1)
  })

  it('sends include_archived=1 for the trash (pending_erase) view too', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setShowTrash(true) })
    expect(result.current.filterParams.include_archived).toBe(1)
  })
})

describe('useCandidateFilters — date-range filter (dashboard period click)', () => {
  it('sends the dateRange param under its own key', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => { result.current.setDateRange({ param: 'created_between', from: '2026-01-01', to: '2026-01-31' }) })
    expect(result.current.filterParams.created_between).toEqual(['2026-01-01', '2026-01-31'])
  })
})

describe('useCandidateFilters — geo radius (straal-blok, PDOK)', () => {
  it('sends lat/lng/radius once a place is applied', async () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    await act(async () => { await result.current.applyGeo('Utrecht', 25) })
    expect(result.current.filterParams.lat).toBe(52.1)
    expect(result.current.filterParams.lng).toBe(5.1)
    expect(result.current.filterParams.radius).toBe(25)
  })

  it('clearGeo removes the radius params again', async () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    await act(async () => { await result.current.applyGeo('Utrecht', 25) })
    act(() => { result.current.clearGeo() })
    expect(result.current.filterParams.lat).toBeUndefined()
    expect(result.current.filterParams.radius).toBeUndefined()
  })
})

describe('useCandidateFilters — clearAllFilters + anyFilterActive', () => {
  it('anyFilterActive flips true once any picked filter is set', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    expect(result.current.anyFilterActive).toBe(false)
    act(() => { result.current.setSelectedStatus(['available']) })
    expect(result.current.anyFilterActive).toBe(true)
  })

  it('clearAllFilters resets every picked filter and their params', () => {
    const { result } = renderHook(() => useCandidateFilters(baseArgs))
    act(() => {
      result.current.setSelectedStatus(['available'])
      result.current.setSelectedPhase(['lead'])
      result.current.setSelectedFunnel(['applied'])
      result.current.setSelectedType(['zzp'])
      result.current.setSelectedOwner(['u1'])
      result.current.setSelectedGeslacht(['female'])
      result.current.setSelectedProvince(['Utrecht'])
      result.current.setSelectedTitle(['Verpleegkundige'])
      result.current.setSelectedLocation(['loc1'])
      result.current.setSelectedPool(['p1'])
      result.current.setSelectedCity(['Utrecht'])
      result.current.setSelectedSource(['referral'])
      result.current.setShowArchived(true)
    })
    expect(result.current.anyFilterActive).toBe(true)
    act(() => { result.current.clearAllFilters() })
    expect(result.current.anyFilterActive).toBe(false)
    expect(result.current.filterParams).toEqual({})
  })
})
