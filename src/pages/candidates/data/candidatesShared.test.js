import { describe, it, expect } from 'vitest'
import {
  isStale, noFollowupUncomputable, isNeverContacted,
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

  // GEENOPVOLGING14: the server defines "geen opvolging" as no planned appointment
  // AND no open task AND no contact within N workdays. A list row carries neither
  // appointments nor tasks, so the page cannot compute it. It used to try, with an
  // older and much narrower rule (a lead who was never contacted), which is why the
  // tile and the list it filtered counted different people: Danny saw the card say
  // "nieuw, geen contact" above rows that all had a contact date. Returning null
  // makes the card render a dash instead of a number meaning something else.
  it('noFollowup has no page-local fallback and never guesses a count', () => {
    expect(noFollowupUncomputable()).toBeNull()
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
  // CMBE-RET-A (2026-07-22): the retention opt-in now reaches the API too — the UI
  // side carries it as camelCase (retentionOptIn, mirrors mapCandidate.ts), mapped
  // to the snake_case API key alongside the other channels.
  it('maps the camelCase retentionOptIn to the snake_case API key (CMBE-RET-A)', () => {
    expect(buildCandidatePatch({ consent: { whatsapp_opt_in: true, retentionOptIn: true, retentionConsentAt: '2026-01-01' } }))
      .toEqual({ consent: { whatsapp_opt_in: true, retention_opt_in: true } })
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
  // DANNY-6: the Herkomst card writes Bron through this builder; without the
  // mapping the save reached an empty body and was skipped entirely.
  it('maps the acquisition source, sending null when cleared', () => {
    expect(buildCandidatePatch({ source: 'indeed' })).toEqual({ source: 'indeed' })
    expect(buildCandidatePatch({ source: '' })).toEqual({ source: null })
    expect(buildCandidatePatch({ source: null })).toEqual({ source: null })
  })
})
