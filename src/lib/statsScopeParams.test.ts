/**
 * pickStatsScopeParams — pure unit tests for the view-scope whitelist (STATS-SCOPE-1).
 * §13: assert the exact output shape, not just "some params survive".
 */
import { describe, it, expect } from 'vitest'
import { pickStatsScopeParams } from './statsScopeParams'

describe('pickStatsScopeParams', () => {
  it('drops every dimension/attention/click-to-filter key, keeping only include_archived', () => {
    const filterParams = {
      status: ['available'], owner_id: ['u1'], search: 'jan', intake_planned: 1,
      phase_key: ['applied'], customer_id: ['c1'], source: ['website'],
      category: ['nurse'], published: 1, closing_soon: 1, lat: 52.1, lng: 5.1, radius: 10,
      include_archived: 1,
    }
    expect(pickStatsScopeParams(filterParams)).toEqual({ include_archived: 1 })
  })

  it('returns an empty object when no view-scope key is present (never invents a default)', () => {
    expect(pickStatsScopeParams({ status: ['blacklist'], search: 'x' })).toEqual({})
  })

  it('returns an empty object for an empty filterParams', () => {
    expect(pickStatsScopeParams({})).toEqual({})
  })
})
