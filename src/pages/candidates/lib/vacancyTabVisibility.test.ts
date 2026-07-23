/**
 * vacancyTabVisibility tests — pure logic, no React. Covers the default
 * (seed-based) behaviour, explicit tenant-setting overrides, and the
 * vocabulary-drift / compare-tolerance edge cases called out in the spec.
 */
import { describe, it, expect } from 'vitest'
import { getVacancyTabDefaults, isVacancyTabVisible } from './vacancyTabVisibility'

// Minimal lookup fixtures mirroring the real DEFAULT_PHASES / DEFAULT_STATUSES seed shape.
const phases = [
  { value: 'lead', label: 'Lead' },
  { value: 'candidate', label: 'Kandidaat' },
]
const statuses = [
  { value: 'available', label: 'Beschikbaar' },
  { value: 'placed', label: 'Geplaatst' },
  { value: 'unavailable', label: 'Niet beschikbaar' },
  { value: 'sick', label: 'Ziek' },
  { value: 'leave', label: 'Verlof' },
  { value: 'blacklist', label: 'Blacklist', is_blacklist: true },
]

describe('getVacancyTabDefaults', () => {
  // The seed default excludes Lead (regex on value/label) and hides for anything
  // flagged blacklist or reading as "unavailable".
  it('excludes the lead phase and hides for blacklist/unavailable statuses', () => {
    const d = getVacancyTabDefaults(phases, statuses)
    expect(d.phases).toEqual(['candidate'])
    expect([...d.hidden_statuses].sort()).toEqual(['blacklist', 'unavailable'])
  })
})

describe('isVacancyTabVisible — no tenant setting (defaults apply)', () => {
  it('hides for a Lead', () => {
    expect(isVacancyTabVisible(null, { phase: 'lead', status: 'available' }, phases, statuses)).toBe(false)
  })
  it('shows for a Candidate with an available status', () => {
    expect(isVacancyTabVisible(null, { phase: 'candidate', status: 'available' }, phases, statuses)).toBe(true)
  })
  it('hides for a Candidate flagged Unavailable', () => {
    expect(isVacancyTabVisible(null, { phase: 'candidate', status: 'unavailable' }, phases, statuses)).toBe(false)
  })
  it('hides for a blacklisted candidate (flag-driven, not slug-matched)', () => {
    expect(isVacancyTabVisible(null, { phase: 'candidate', status: 'blacklist' }, phases, statuses)).toBe(false)
  })
})

describe('isVacancyTabVisible — explicit tenant config overrides the default', () => {
  it('an explicit empty phases array hides the tab everywhere', () => {
    expect(isVacancyTabVisible({ phases: [] }, { phase: 'candidate', status: 'available' }, phases, statuses)).toBe(false)
  })
  it('explicitly allowing the lead phase overrides the default', () => {
    expect(isVacancyTabVisible({ phases: ['lead', 'candidate'] }, { phase: 'lead', status: 'available' }, phases, statuses)).toBe(true)
  })
  it('an explicit empty hidden_statuses list overrides the default (nothing hidden)', () => {
    expect(isVacancyTabVisible({ hidden_statuses: [] }, { phase: 'candidate', status: 'unavailable' }, phases, statuses)).toBe(true)
  })
})

describe('isVacancyTabVisible — vocabulary drift & compare tolerance', () => {
  it('a phase value not in the tenant lookup (renamed/removed) stays visible', () => {
    expect(isVacancyTabVisible(null, { phase: 'alumni', status: 'available' }, phases, statuses)).toBe(true)
  })
  it('compares case- and whitespace-tolerantly', () => {
    expect(isVacancyTabVisible(null, { phase: ' Candidate ', status: ' AVAILABLE ' }, phases, statuses)).toBe(true)
    expect(isVacancyTabVisible(null, { phase: ' LEAD ', status: 'available' }, phases, statuses)).toBe(false)
  })
  it('an empty/missing phase or status on the candidate never blocks visibility', () => {
    expect(isVacancyTabVisible(null, { phase: null, status: null }, phases, statuses)).toBe(true)
  })
})
