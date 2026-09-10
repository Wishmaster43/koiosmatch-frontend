/**
 * lookupUtils — regression coverage for normalizeOptions' flag pass-through
 * (KLANT-BLACKLIST-PROMPT-1): `is_blacklist` on a lookup row must surface as
 * `isBlacklist`, mirroring the existing `is_default`/`is_won`/`is_lost` treatment.
 */
import { describe, it, expect } from 'vitest'
import type { AxiosResponse } from 'axios'
import { normalizeOptions, mapLookupResponse } from './lookupUtils'

describe('normalizeOptions · is_blacklist pass-through', () => {
  it('maps is_blacklist to isBlacklist on a lookup row that carries it', () => {
    const out = normalizeOptions([{ id: 1, value: 'bl', label: 'Blacklist', is_blacklist: true }])
    expect(out?.[0]?.isBlacklist).toBe(true)
  })

  it('omits isBlacklist on a row that never carries the flag', () => {
    const out = normalizeOptions([{ id: 1, value: 'available', label: 'Available' }])
    expect(out?.[0]?.isBlacklist).toBeUndefined()
  })

  it('maps is_blacklist: false explicitly', () => {
    const out = normalizeOptions([{ id: 1, value: 'placed', label: 'Placed', is_blacklist: false }])
    expect(out?.[0]?.isBlacklist).toBe(false)
  })
})

// mapLookupResponse (DRY round 10, MISC — moved here from a standalone module):
// the .rows[]-response mapper used by useMatchStopReasons/useOutreachOutcomes.
describe('mapLookupResponse', () => {
  it('maps rows to LookupOptions, preserving the exact colour value', () => {
    const response = {
      data: {
        data: [
          { value: 'opt1', label: 'Option 1', color: 'var(--color-primary-bg)' },
          { value: 'opt2', label: 'Option 2', color: 'var(--color-info-bg)' },
        ],
      },
    } as AxiosResponse

    const result = mapLookupResponse(response)
    expect(result).toHaveLength(2)
    expect(result?.[0]).toMatchObject({ value: 'opt1', label: 'Option 1' })
    expect(result?.[1]).toMatchObject({ value: 'opt2', label: 'Option 2' })
    // Assert the exact token, not just "some value" — a mapper bug that dropped
    // the real colour and fell back to a default would still pass toBeDefined.
    expect(result?.[0]?.color).toBe('var(--color-primary-bg)')
    expect(result?.[1]?.color).toBe('var(--color-info-bg)')
  })

  it('returns null for empty rows array', () => {
    const response = { data: { data: [] } } as AxiosResponse
    expect(mapLookupResponse(response)).toBeNull()
  })

  it('returns null when data is not an array', () => {
    const response = { data: { data: undefined } } as AxiosResponse
    expect(mapLookupResponse(response)).toBeNull()
  })
})
