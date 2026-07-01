import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDateFormat } from './datetime'

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
