// Test the shared search score mapping function.
import { describe, it, expect } from 'vitest'
import { mapSearchHit } from './searchScore'
import type { Criterion } from '@/components/match/MatchScoreBlock'

describe('mapSearchHit', () => {
  it('maps distance_km and score from match', () => {
    const match = { distance_km: '12.5', score: '85.3', criteria: [], ai_advised: false }
    const entity = { lat: '52.3', lng: '4.9' }
    const result = mapSearchHit(match, entity)

    expect(result.distanceKm).toBe(12.5)
    expect(result.score).toBe(85.3)
    expect(result.lat).toBe(52.3)
    expect(result.lng).toBe(4.9)
  })

  it('handles score as a string number', () => {
    const match = { distance_km: null, score: '77', criteria: [], ai_advised: false }
    const entity = { lat: null, lng: null }
    const result = mapSearchHit(match, entity)

    expect(result.score).toBe(77)
    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
  })

  it('handles null score', () => {
    const match = { distance_km: null, score: null, criteria: [], ai_advised: false }
    const entity = { lat: '52.3', lng: '4.9' }
    const result = mapSearchHit(match, entity)

    expect(result.score).toBeNull()
  })

  it('extracts criteria array', () => {
    const criteria: Criterion[] = [{ score: 85, key: 'experience' }]
    const match = { distance_km: null, score: null, criteria, ai_advised: false }
    const entity = { lat: null, lng: null }
    const result = mapSearchHit(match, entity)

    expect(result.criteria).toEqual(criteria)
  })

  it('returns empty criteria array when not present', () => {
    const match = { distance_km: null, score: null, ai_advised: false }
    const entity = { lat: null, lng: null }
    const result = mapSearchHit(match, entity)

    expect(result.criteria).toEqual([])
  })

  it('maps aiAdvised and aiAdviceReason', () => {
    const match = { distance_km: null, score: null, criteria: [], ai_advised: true, ai_advice_reason: 'Good match for role' }
    const entity = { lat: null, lng: null }
    const result = mapSearchHit(match, entity)

    expect(result.aiAdvised).toBe(true)
    expect(result.aiAdviceReason).toBe('Good match for role')
  })

  it('handles missing aiAdviceReason as null', () => {
    const match = { distance_km: null, score: null, criteria: [], ai_advised: false }
    const entity = { lat: null, lng: null }
    const result = mapSearchHit(match, entity)

    expect(result.aiAdviceReason).toBeNull()
  })
})
