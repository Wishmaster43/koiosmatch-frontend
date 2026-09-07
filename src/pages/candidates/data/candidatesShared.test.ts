/**
 * candidatesShared.buildCandidatePatch — the drawer→API key map. AVG-RET-2-TAAL-1:
 * preferredLanguage travels as preferred_language and an emptied value clears it
 * (null), never an empty string the backend would reject.
 */
import { describe, it, expect } from 'vitest'
import { buildCandidatePatch } from './candidatesShared'

describe('buildCandidatePatch · preferredLanguage', () => {
  it('maps a picked code to preferred_language', () => {
    expect(buildCandidatePatch({ preferredLanguage: 'pl' })).toEqual({ preferred_language: 'pl' })
  })

  it('clears with null when the recruiter empties the field', () => {
    expect(buildCandidatePatch({ preferredLanguage: '' })).toEqual({ preferred_language: null })
  })

  it('sends nothing when the key is absent from the patch', () => {
    expect(buildCandidatePatch({ placeOfBirth: 'Utrecht' })).toEqual({ place_of_birth: 'Utrecht' })
  })
})

// I18N-1 (BE 5a109b00): the second address line travels as address_line_2 — the
// builder is an allowlist, so a missing branch would silently drop the field.
describe('buildCandidatePatch · addressLine2', () => {
  it('maps addressLine2 to address_line_2 and lets an empty string clear it', () => {
    expect(buildCandidatePatch({ addressLine2: 'Gebouw B' })).toEqual({ address_line_2: 'Gebouw B' })
    expect(buildCandidatePatch({ addressLine2: '' })).toEqual({ address_line_2: '' })
  })
  it('leaves the key out when the patch does not carry it', () => {
    expect(buildCandidatePatch({ city: 'Delft' })).not.toHaveProperty('address_line_2')
  })
})

// KEY-ADOPTION: stable lookup keys for nationality, source, and blacklist_reason.
describe('buildCandidatePatch · KEY-ADOPTION', () => {
  it('includes nationality_key alongside the name', () => {
    expect(buildCandidatePatch({ nationality: 'Nederlands', nationalityKey: 'nl_NL' })).toEqual({
      nationality: 'Nederlands',
      nationality_key: 'nl_NL',
    })
  })

  it('includes source_key alongside the name', () => {
    expect(buildCandidatePatch({ source: 'Indeed', sourceKey: 'indeed' })).toEqual({
      source: 'Indeed',
      source_key: 'indeed',
    })
  })

  it('includes blacklist_reason_key alongside the name', () => {
    expect(buildCandidatePatch({ blacklistReason: 'Non-compliant', blacklistReasonKey: 'non_compliant' })).toEqual({
      blacklist_reason: 'Non-compliant',
      blacklist_reason_key: 'non_compliant',
    })
  })

  it('handles null _key values', () => {
    expect(buildCandidatePatch({ nationality: 'Nederlands', nationalityKey: null })).toEqual({
      nationality: 'Nederlands',
      nationality_key: null,
    })
  })

  it('sends all three _key fields together in a complex patch', () => {
    const patch = {
      nationality: 'Nederlands',
      nationalityKey: 'nl_NL',
      source: 'Indeed',
      sourceKey: 'indeed',
      blacklistReason: 'Non-compliant',
      blacklistReasonKey: 'non_compliant',
      gender: 'male',
    }
    expect(buildCandidatePatch(patch)).toEqual({
      nationality: 'Nederlands',
      nationality_key: 'nl_NL',
      source: 'Indeed',
      source_key: 'indeed',
      blacklist_reason: 'Non-compliant',
      blacklist_reason_key: 'non_compliant',
      gender: 'male',
    })
  })

  it('omits _key fields when not present in the patch', () => {
    const body = buildCandidatePatch({ nationality: 'Nederlands', gender: 'male' })
    expect(body).toEqual({ nationality: 'Nederlands', gender: 'male' })
    expect('nationality_key' in body).toBe(false)
  })
})
