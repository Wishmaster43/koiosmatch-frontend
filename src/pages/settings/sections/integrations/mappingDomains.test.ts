import { describe, it, expect } from 'vitest'
import { MAPPING_DOMAINS } from './mappingDomains'

describe('mappingDomains', () => {
  // The tab order is part of the contract.
  it('pins the domain order', () => {
    expect([...MAPPING_DOMAINS]).toEqual(['cao', 'scale', 'step', 'function'])
  })
})
