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
