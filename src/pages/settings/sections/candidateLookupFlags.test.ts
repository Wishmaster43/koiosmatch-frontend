import { describe, it, expect } from 'vitest'
import { slugify } from './candidateLookupFlags'

// slugify is shared between CandidateLookupsSettings and CandidateLookupItemModal.
describe('slugify', () => {
  it('lowercases, trims and replaces non-alphanumeric runs with underscores', () => {
    expect(slugify('Niet actief')).toBe('niet_actief')
  })

  it('strips leading/trailing underscores', () => {
    expect(slugify('  -Actief!-  ')).toBe('actief')
  })

  it('leaves an already-clean slug untouched', () => {
    expect(slugify('applied')).toBe('applied')
  })
})
