/**
 * lookupUtils — regression coverage for normalizeOptions' flag pass-through
 * (KLANT-BLACKLIST-PROMPT-1): `is_blacklist` on a lookup row must surface as
 * `isBlacklist`, mirroring the existing `is_default`/`is_won`/`is_lost` treatment.
 */
import { describe, it, expect } from 'vitest'
import { normalizeOptions } from './lookupUtils'

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
