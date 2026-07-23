/**
 * canonicalizeToOptions — regression for "1 geselecteerd maar geen vinkje"
 * (Danny 23-07): seed value 'open' must converge onto the API option 'Open'.
 */
import { describe, it, expect } from 'vitest'
import { canonicalizeToOptions } from './lookupUtils'

const options = [
  { value: 'Open', label: 'Open' },
  { value: 'Concept', label: 'Concept' },
  { value: 'paused', label: 'Gepauzeerd' },
]

describe('canonicalizeToOptions', () => {
  it('maps a seed-cased value onto the canonical option value', () => {
    expect(canonicalizeToOptions(['open'], options)).toEqual(['Open'])
  })
  it('matches by label too (stored label, canonical value out)', () => {
    expect(canonicalizeToOptions(['gepauzeerd'], options)).toEqual(['paused'])
  })
  it('dedupes when raw and canonical variants are both present', () => {
    expect(canonicalizeToOptions(['open', 'Open'], options)).toEqual(['Open'])
  })
  it('passes unknown values through (vocabulary drift never drops a filter)', () => {
    expect(canonicalizeToOptions(['legacy-status'], options)).toEqual(['legacy-status'])
  })
  it('is trim/whitespace tolerant', () => {
    expect(canonicalizeToOptions([' open '], options)).toEqual(['Open'])
  })
})
