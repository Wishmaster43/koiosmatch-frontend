/**
 * geoFilter — tests for the shared applyGeo helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyGeo } from './geoFilter'
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
