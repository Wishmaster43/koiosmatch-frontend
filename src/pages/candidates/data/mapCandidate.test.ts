/**
 * mapCandidate — KEY-ADOPTION test: the mapper reads _key fields from the API
 * and maps them to camelCase twins on the Candidate model.
 */
import { describe, it, expect } from 'vitest'
import { mapCandidate } from './mapCandidate'
import type { ApiCandidate } from '@/types/candidate'

describe('mapCandidate · KEY-ADOPTION', () => {
  it('reads nationality_key and maps it to nationalityKey', () => {
    const api: ApiCandidate = {
      id: '1',
      nationality: 'Nederlands',
      nationality_key: 'nl_NL',
    }
    const candidate = mapCandidate(api)
    expect(candidate.nationality).toBe('Nederlands')
    expect(candidate.nationalityKey).toBe('nl_NL')
  })

  it('reads source_key and maps it to sourceKey', () => {
    const api: ApiCandidate = {
      id: '1',
      source: 'Indeed',
      source_key: 'indeed',
    }
    const candidate = mapCandidate(api)
    expect(candidate.source).toBe('Indeed')
    expect(candidate.sourceKey).toBe('indeed')
  })

  it('reads blacklist_reason_key and maps it to blacklistReasonKey', () => {
    const api: ApiCandidate = {
      id: '1',
      blacklist_reason: 'Non-compliant',
      blacklist_reason_key: 'non_compliant',
    }
    const candidate = mapCandidate(api)
    expect(candidate.blacklistReason).toBe('Non-compliant')
    expect(candidate.blacklistReasonKey).toBe('non_compliant')
  })

  it('sets _key fields to null when absent from the API', () => {
    const api: ApiCandidate = {
      id: '1',
      nationality: 'Nederlands',
      source: 'Indeed',
      blacklist_reason: null,
    }
    const candidate = mapCandidate(api)
    expect(candidate.nationalityKey).toBe(null)
    expect(candidate.sourceKey).toBe(null)
    expect(candidate.blacklistReasonKey).toBe(null)
  })

  it('handles all three _key fields together', () => {
    const api: ApiCandidate = {
      id: '1',
      nationality: 'Nederlands',
      nationality_key: 'nl_NL',
      source: 'Indeed',
      source_key: 'indeed',
      blacklist_reason: 'Non-compliant',
      blacklist_reason_key: 'non_compliant',
    }
    const candidate = mapCandidate(api)
    expect(candidate.nationality).toBe('Nederlands')
    expect(candidate.nationalityKey).toBe('nl_NL')
    expect(candidate.source).toBe('Indeed')
    expect(candidate.sourceKey).toBe('indeed')
    expect(candidate.blacklistReason).toBe('Non-compliant')
    expect(candidate.blacklistReasonKey).toBe('non_compliant')
  })
})
