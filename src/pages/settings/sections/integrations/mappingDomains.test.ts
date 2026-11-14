import { describe, it, expect } from 'vitest'
import { MAPPING_DOMAINS, canonicalMappingDomain } from './mappingDomains'

describe('mappingDomains', () => {
  // The tab order is part of the contract.
  it('pins the domain order', () => {
    expect([...MAPPING_DOMAINS]).toEqual(['cao', 'scale', 'step', 'function'])
  })

  // The three legacy Dutch ids map to English.
  it('maps the Dutch ids', () => {
    expect(canonicalMappingDomain('schaal')).toBe('scale')
    expect(canonicalMappingDomain('trede')).toBe('step')
    expect(canonicalMappingDomain('functie')).toBe('function')
  })

  // English, unknown and inherited names pass through.
  it('passes other ids through', () => {
    expect(canonicalMappingDomain('scale')).toBe('scale')
    expect(canonicalMappingDomain('cao')).toBe('cao')
    expect(canonicalMappingDomain('other')).toBe('other')
    expect(canonicalMappingDomain('constructor')).toBe('constructor')
  })
})
