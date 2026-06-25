import { describe, it, expect } from 'vitest'
import { formatDate, formatTime, formatHours } from './ordersTableParts'

// Date objects are built from local components so the assertions are timezone-safe.

describe('formatDate', () => {
  it('renders DD-MM-YYYY (zero-padded)', () => {
    expect(formatDate(new Date(2026, 5, 25))).toBe('25-06-2026')
    expect(formatDate(new Date(2026, 0, 3))).toBe('03-01-2026')
  })
  it('dashes empty input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
})

describe('formatTime', () => {
  it('renders HH:MM (zero-padded)', () => {
    expect(formatTime(new Date(2026, 5, 25, 14, 5))).toBe('14:05')
    expect(formatTime(new Date(2026, 5, 25, 9, 0))).toBe('09:00')
  })
  it('dashes empty input', () => {
    expect(formatTime(null)).toBe('—')
  })
})

describe('formatHours', () => {
  it('renders two decimals (incl. zero)', () => {
    expect(formatHours(8.5)).toBe('8.50')
    expect(formatHours(0)).toBe('0.00')
    expect(formatHours('7.25')).toBe('7.25')
  })
  it('dashes null/undefined', () => {
    expect(formatHours(null)).toBe('—')
    expect(formatHours(undefined)).toBe('—')
  })
})
