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

  it('isNoFollowup: only a lead (Phase axis) without any contact', () => {
    expect(isNoFollowup({ phase: 'lead', lastContactAt: null })).toBe(true)
    expect(isNoFollowup({ phase: 'lead', lastContactAt: daysAgo(1) })).toBe(false)
    expect(isNoFollowup({ phase: 'candidate', lastContactAt: null })).toBe(false)
  })
  it('isNoFollowup: bug regression — must read `phase`, never `status` (Deployability axis)', () => {
    // Real candidates never have status === 'lead' ('lead' is a Phase value, not a
    // Deployability one) — the old code compared status to 'lead' and so ALWAYS
    // returned false in production, even though a naive test with status:'lead'
    // fixtures made it look like it worked. Prove the fallback now actually fires
    // off `phase`, and that a matching `status` alone is not enough.
    expect(isNoFollowup({ status: 'lead', lastContactAt: null })).toBe(false)
    expect(isNoFollowup({ status: 'lead', phase: 'candidate', lastContactAt: null })).toBe(false)
    expect(isNoFollowup({ status: 'available', phase: 'lead', lastContactAt: null })).toBe(true)
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
  it('sends consent nested with only opt-in flags (never the _consent_at timestamps)', () => {
    expect(buildCandidatePatch({ consent: { whatsapp_opt_in: true, email_opt_in: false, whatsapp_consent_at: '2026-01-01' } }))
      .toEqual({ consent: { whatsapp_opt_in: true, email_opt_in: false } })
  })
  it('only includes keys present in the patch (empty → {})', () => {
    expect(buildCandidatePatch({})).toEqual({})
    expect(buildCandidatePatch({ city: 'Utrecht' })).toEqual({ city: 'Utrecht' })
  })
  // BE 2026-07-20: mobile is validated separately from phone (CandidateProfileRequest
  // `mobile`) — both must reach the API body under their own key, independently.
  it('maps phone and mobile as independent keys (split fields)', () => {
    expect(buildCandidatePatch({ phone: '0301234567', mobile: '0612345678' }))
      .toEqual({ phone: '0301234567', mobile: '0612345678' })
    expect(buildCandidatePatch({ mobile: '0612345678' })).toEqual({ mobile: '0612345678' })
  })
  // COUNTRY-1: home-address country rides straight through as its ISO-2 code;
  // an explicit clear ('') must send null, never an empty string, so the backend
  // actually unsets the column instead of storing a blank string.
  it('maps country (ISO-2 code), sending null when cleared', () => {
    expect(buildCandidatePatch({ country: 'NL' })).toEqual({ country: 'NL' })
    expect(buildCandidatePatch({ country: '' })).toEqual({ country: null })
  })
})
