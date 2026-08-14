/**
 * reportCompareMode — proves the discriminated union can never produce the
 * backend's ambiguous "both compare and compare_from/compare_to" 422 case,
 * client-side, structurally (not just by convention).
 */
import { describe, it, expect } from 'vitest'
import { compareModeToParams } from './reportCompareMode'

describe('compareModeToParams', () => {
  it('off -> no params at all', () => {
    expect(compareModeToParams({ kind: 'off' })).toBeNull()
  })

  it('previous_period -> only `compare`', () => {
    expect(compareModeToParams({ kind: 'previous_period' })).toEqual({ compare: 'previous_period' })
  })

  it('previous_year -> only `compare`', () => {
    expect(compareModeToParams({ kind: 'previous_year' })).toEqual({ compare: 'previous_year' })
  })

  it('custom -> only compare_from/compare_to, never a `compare` key', () => {
    const params = compareModeToParams({ kind: 'custom', from: '2025-01-01', to: '2025-01-31' })
    expect(params).toEqual({ compare_from: '2025-01-01', compare_to: '2025-01-31' })
    expect(params).not.toHaveProperty('compare')
  })

  it('an incomplete custom range yields no params (never a half-built request)', () => {
    expect(compareModeToParams({ kind: 'custom', from: '2025-01-01', to: '' })).toBeNull()
    expect(compareModeToParams({ kind: 'custom', from: '', to: '' })).toBeNull()
  })
})
