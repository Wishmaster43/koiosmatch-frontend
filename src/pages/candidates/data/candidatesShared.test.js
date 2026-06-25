import { describe, it, expect } from 'vitest'
import {
  isStale, isNoFollowup, isNeverContacted,
  toggleOneValue, metaOf, optsFrom, initialsOf, buildCandidatePatch,
} from './candidatesShared'

// Date helper: ISO string for N days before now.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

describe('attention predicates', () => {
  it('isStale: never contacted (null) is stale', () => {
    expect(isStale({ lastContactAt: null })).toBe(true)
    expect(isStale({})).toBe(true)
  })
  it('isStale: contacted within 6 months is not stale, older than 6 months is', () => {
    expect(isStale({ lastContactAt: daysAgo(100) })).toBe(false)
    expect(isStale({ lastContactAt: daysAgo(200) })).toBe(true)
  })

  it('isNoFollowup: only a lead without any contact', () => {
    expect(isNoFollowup({ status: 'lead', lastContactAt: null })).toBe(true)
    expect(isNoFollowup({ status: 'lead', lastContactAt: daysAgo(1) })).toBe(false)
    expect(isNoFollowup({ status: 'candidate', lastContactAt: null })).toBe(false)
  })

  it('isNeverContacted: true only when no contact moment', () => {
    expect(isNeverContacted({ lastContactAt: null })).toBe(true)
    expect(isNeverContacted({ lastContactAt: daysAgo(1) })).toBe(false)
  })
})

describe('toggleOneValue', () => {
  // Capture the updater the helper passes to the setter, then exercise it.
  const updaterFor = (value) => {
    let captured
    toggleOneValue((fn) => { captured = fn }, value)
    return captured
  }
  it('sets the single value from empty', () => {
    expect(updaterFor('a')([])).toEqual(['a'])
  })
  it('clears when the same single value is re-picked', () => {
    expect(updaterFor('a')(['a'])).toEqual([])
  })
  it('replaces a different selection (and multi-selections)', () => {
    expect(updaterFor('a')(['b'])).toEqual(['a'])
    expect(updaterFor('a')(['a', 'b'])).toEqual(['a'])
  })
})

describe('metaOf / optsFrom', () => {
  const list = [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]
  it('metaOf finds by value', () => {
    expect(metaOf(list, 'y')).toEqual({ value: 'y', label: 'Y' })
    expect(metaOf(list, 'z')).toBeUndefined()
  })
  it('optsFrom counts occurrences and maps labels', () => {
    expect(optsFrom(['a', 'b', 'a'])).toEqual([
      { value: 'a', label: 'a', count: 2 },
      { value: 'b', label: 'b', count: 1 },
    ])
    expect(optsFrom(['a'], (v) => v.toUpperCase())).toEqual([{ value: 'a', label: 'A', count: 1 }])
  })
})

describe('initialsOf', () => {
  it('takes the first two name parts (quirk: tussenvoegsels count, so "Bente de Jong" → "BD")', () => {
    expect(initialsOf('Bente de Jong')).toBe('BD')
    expect(initialsOf('Sophie van den Berg')).toBe('SV')
    expect(initialsOf('Sophie')).toBe('S')
  })
  it('falls back to ? for empty', () => {
    expect(initialsOf('')).toBe('?')
    expect(initialsOf()).toBe('?')
  })
})

describe('buildCandidatePatch', () => {
  it('maps the 3-layer model + header fields to API keys', () => {
    expect(buildCandidatePatch({
      candidateTypes: ['on_call'], status: 'matched', stage: 'hired',
      firstname: 'A', lastname: 'B', title: 'Verzorgende IG',
    })).toEqual({
      candidate_types: ['on_call'], status: 'matched', funnel_type: 'hired',
      first_name: 'A', last_name: 'B', function_title: 'Verzorgende IG',
    })
  })
  it('maps profile/address fields', () => {
    expect(buildCandidatePatch({ dob: '1990-01-01', postalCode: '1234AB', houseNumber: '5' }))
      .toEqual({ date_of_birth: '1990-01-01', postcode: '1234AB', house_number: '5' })
  })
  it('flattens consent toggles to flat booleans', () => {
    expect(buildCandidatePatch({ consent: { whatsapp_consent: true, email_consent: false } }))
      .toEqual({ whatsapp_consent: true, email_consent: false })
  })
  it('only includes keys present in the patch (empty → {})', () => {
    expect(buildCandidatePatch({})).toEqual({})
    expect(buildCandidatePatch({ city: 'Utrecht' })).toEqual({ city: 'Utrecht' })
  })
})
