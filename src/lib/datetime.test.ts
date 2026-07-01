import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDateFormat, calcAge, daysUntilBirthday } from './datetime'

// Note: i18n is not initialised in tests → locale falls back to nl-NL (§3B).
describe('useDateFormat', () => {
  it('formats a date as DD-MM-YYYY', () => {
    const { result } = renderHook(() => useDateFormat())
    // Midday local time so the calendar day is timezone-stable.
    expect(result.current.formatDate('2026-06-30T12:00:00')).toBe('30-06-2026')
  })

  it('shows an em-dash for empty input', () => {
    const { result } = renderHook(() => useDateFormat())
    expect(result.current.formatDate(null)).toBe('—')
    expect(result.current.formatDate(undefined)).toBe('—')
  })

  it('returns the raw value when it cannot be parsed', () => {
    const { result } = renderHook(() => useDateFormat())
    expect(result.current.formatDate('not-a-date')).toBe('not-a-date')
  })
})

describe('calcAge', () => {
  const now = new Date('2026-06-08T12:00:00') // reference "today"
  it('counts whole years, birthday already passed this year', () => {
    expect(calcAge('1966-05-01', now)).toBe(60)
  })
  it('subtracts a year when the birthday is still ahead this year', () => {
    expect(calcAge('1966-07-01', now)).toBe(59)
  })
  it('handles the birthday being today', () => {
    expect(calcAge('1966-06-08', now)).toBe(60)
  })
  it('returns null for missing/unparseable/implausible values', () => {
    expect(calcAge(null, now)).toBeNull()
    expect(calcAge('not-a-date', now)).toBeNull()
    expect(calcAge('2100-01-01', now)).toBeNull()
  })
})

describe('daysUntilBirthday', () => {
  const now = new Date('2026-06-08T12:00:00')
  it('is 0 on the birthday itself', () => {
    expect(daysUntilBirthday('1966-06-08', now)).toBe(0)
  })
  it('is 1 the day before', () => {
    expect(daysUntilBirthday('1990-06-09', now)).toBe(1)
  })
  it('rolls over to next year once the birthday has passed', () => {
    expect(daysUntilBirthday('1990-06-07', now)).toBe(364)
  })
  it('returns null for missing/unparseable values', () => {
    expect(daysUntilBirthday(undefined, now)).toBeNull()
    expect(daysUntilBirthday('nope', now)).toBeNull()
  })
})
