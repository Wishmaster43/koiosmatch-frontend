// scanState behaviour: only pending and rejected are worth showing.
import { describe, it, expect } from 'vitest'
import { scanState } from './scanState'

describe('scanState', () => {
  it('returns pending and rejected as is', () => {
    expect(scanState('pending')).toBe('pending')
    expect(scanState('rejected')).toBe('rejected')
  })
  it('returns null for clean, undefined and null', () => {
    expect(scanState('clean')).toBeNull()
    expect(scanState(undefined)).toBeNull()
    expect(scanState(null)).toBeNull()
  })
})
