/**
 * geoFilter — tests for the shared applyGeo helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { applyGeo, useApplyGeoFilter } from './geoFilter'
import * as geocodeModule from './geocode'

vi.mock('./geocode')

describe('geoFilter.applyGeo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates filter + map state on successful geocode', async () => {
    const mockGeocodeLocation = vi.spyOn(geocodeModule, 'geocodeLocation')
    mockGeocodeLocation.mockResolvedValue({
      lat: 52.1,
      lng: 4.9,
      label: 'Den Haag',
    })

    const setGeoHint = vi.fn()
    const setGeoFilter = vi.fn()
    const setMapCenter = vi.fn()
    const setMapRadius = vi.fn()

    await applyGeo('Den Haag', 20, 'Not found', setGeoHint, setGeoFilter, setMapCenter, setMapRadius)

    expect(setGeoHint).toHaveBeenCalledWith(null)
    expect(setGeoFilter).toHaveBeenCalledWith({
      q: 'Den Haag',
      km: 20,
      lat: 52.1,
      lng: 4.9,
      label: 'Den Haag · 20 km',
    })
    expect(setMapCenter).toHaveBeenCalledWith({ lat: 52.1, lng: 4.9 })
    expect(setMapRadius).toHaveBeenCalledWith(20)
  })

  it('sets hint on geocode failure', async () => {
    const mockGeocodeLocation = vi.spyOn(geocodeModule, 'geocodeLocation')
    mockGeocodeLocation.mockResolvedValue(null)

    const setGeoHint = vi.fn()
    const setGeoFilter = vi.fn()
    const setMapCenter = vi.fn()
    const setMapRadius = vi.fn()

    await applyGeo('NonExistent', 20, 'Not found', setGeoHint, setGeoFilter, setMapCenter, setMapRadius)

    expect(setGeoHint).toHaveBeenCalledWith('Not found')
    expect(setGeoFilter).not.toHaveBeenCalled()
    expect(setMapCenter).not.toHaveBeenCalled()
    expect(setMapRadius).not.toHaveBeenCalled()
  })
})

describe('useApplyGeoFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a stable callback that forwards to applyGeo with the translated not-found hint', async () => {
    const mockGeocodeLocation = vi.spyOn(geocodeModule, 'geocodeLocation')
    mockGeocodeLocation.mockResolvedValue({ lat: 1, lng: 2, label: 'X' })
    const t = (k: string) => (k === 'common:filters.notFound' ? 'Niet gevonden' : k)
    const setGeoHint = vi.fn()
    const setGeoFilter = vi.fn()
    const setMapCenter = vi.fn()
    const setMapRadius = vi.fn()

    const { result, rerender } = renderHook(
      ({ tFn }) => useApplyGeoFilter(tFn, setGeoHint, setGeoFilter, setMapCenter, setMapRadius),
      { initialProps: { tFn: t } },
    )
    const firstCallback = result.current

    await act(async () => { await result.current('Amsterdam', 15) })
    expect(setGeoFilter).toHaveBeenCalledWith({ q: 'Amsterdam', km: 15, lat: 1, lng: 2, label: 'X · 15 km' })

    // Same setters + same t identity → the returned callback stays stable (useCallback).
    rerender({ tFn: t })
    expect(result.current).toBe(firstCallback)
  })
})
