import { describe, it, expect } from 'vitest'
import { graceBoundary, graceWindowDays } from './graceWindow'

const from = new Date(2026, 0, 31, 10, 0, 0)

describe('graceBoundary', () => {
  it('adds days and weeks as whole days', () => {
    expect(graceBoundary(from, { amount: 30, unit: 'days' })).toEqual(new Date(2026, 2, 2, 10, 0, 0))
    expect(graceBoundary(from, { amount: 2, unit: 'weeks' })).toEqual(new Date(2026, 1, 14, 10, 0, 0))
  })

  it('treats a bare number as days', () => {
    expect(graceBoundary(from, 10)).toEqual(new Date(2026, 1, 10, 10, 0, 0))
  })

  it('clamps months without overflow', () => {
    expect(graceBoundary(from, { amount: 1, unit: 'months' })).toEqual(new Date(2026, 1, 28, 10, 0, 0))
  })

  it('lifts a window below 7 days to the 7-day floor', () => {
    const floor = new Date(2026, 1, 7, 10, 0, 0)
    expect(graceBoundary(from, { amount: 3, unit: 'days' })).toEqual(floor)
    expect(graceBoundary(from, { amount: 3, unit: 'workdays' })).toEqual(floor)
  })

  it('walks workdays from the start of the day, skipping weekends', () => {
    // Mon 2026-02-02 + 10 workdays = Mon 2026-02-16 (start of day).
    expect(graceBoundary(new Date(2026, 1, 2, 9, 0, 0), { amount: 10, unit: 'workdays' })).toEqual(new Date(2026, 1, 16))
  })
})

describe('graceWindowDays', () => {
  it('returns whole days to the floored boundary', () => {
    expect(graceWindowDays(from, { amount: 30, unit: 'days' })).toBe(30)
    expect(graceWindowDays(from, { amount: 1, unit: 'weeks' })).toBe(7)
    expect(graceWindowDays(from, { amount: 2, unit: 'days' })).toBe(7)
    expect(graceWindowDays(from, { amount: 1, unit: 'months' })).toBe(28)
  })
})
