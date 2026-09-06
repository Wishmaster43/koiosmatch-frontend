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
