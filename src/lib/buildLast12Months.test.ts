import { describe, it, expect } from 'vitest'
import { buildLast12Months } from './localDate'

// buildLast12Months is the shared month-picker list (AdminInvoicesSettings, TenantUsageSettings) — DRY extraction.
describe('buildLast12Months', () => {
  it('returns 12 months, newest first, as YYYY-MM values', () => {
    const months = buildLast12Months('en-GB')
    expect(months).toHaveLength(12)
    const now = new Date()
    const expectedFirst = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(months[0].value).toBe(expectedFirst)
    // Every value is well-formed and every label is a non-empty string.
    for (const m of months) {
      expect(m.value).toMatch(/^\d{4}-\d{2}$/)
      expect(m.label.length).toBeGreaterThan(0)
    }
  })

  it('formats the label in the given locale', () => {
    const months = buildLast12Months('nl-NL')
    // Dutch month names are lowercase (e.g. "september 2026").
    expect(months[0].label).toMatch(/^[a-z]+ \d{4}$/)
  })
})
