import { describe, it, expect } from 'vitest'
import { toCoord } from './coords'

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
