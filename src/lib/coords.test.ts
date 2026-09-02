import { describe, it, expect } from 'vitest'
import { toCoord, countPendingGeocode } from './coords'

// PDOK-LATLNG-1: Laravel serialises decimal columns as strings — the exact case
// that made the PDOK panel show "not geocoded" for geocoded candidates.
describe('toCoord', () => {
  it('accepts real numbers', () => {
    expect(toCoord(53.2185923)).toBe(53.2185923)
    expect(toCoord(0)).toBe(0)
  })

  it('coerces numeric strings (Laravel decimal serialisation)', () => {
    expect(toCoord('53.2185923')).toBe(53.2185923)
    expect(toCoord('6.6206347')).toBe(6.6206347)
    expect(toCoord('-1.5')).toBe(-1.5)
  })

  it('maps junk to null', () => {
    expect(toCoord(null)).toBeNull()
    expect(toCoord(undefined)).toBeNull()
    expect(toCoord('')).toBeNull()
    expect(toCoord('abc')).toBeNull()
    expect(toCoord(NaN)).toBeNull()
    expect(toCoord(Infinity)).toBeNull()
  })
})

// PENDING-GEOCODE-1 (Danny 02-09): city-with-no-coords rows are "pending"; a row
// with no address at all can never land on the map and must not be counted.
describe('countPendingGeocode', () => {
  it('counts a row with a city but null coordinates', () => {
    expect(countPendingGeocode([{ city: 'Utrecht', lat: null, lng: null }])).toBe(1)
  })

  it('does not count a row whose coordinates arrive as numeric strings', () => {
    expect(countPendingGeocode([{ city: 'Utrecht', lat: '52.09', lng: '5.12' }])).toBe(0)
  })

  it('ignores a row with no city and no coordinates', () => {
    expect(countPendingGeocode([{ city: null, lat: null, lng: null }])).toBe(0)
  })

  it('returns 0 for an empty list', () => {
    expect(countPendingGeocode([])).toBe(0)
  })
})
