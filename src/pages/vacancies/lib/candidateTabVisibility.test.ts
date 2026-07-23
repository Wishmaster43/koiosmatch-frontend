/**
 * candidateTabVisibility tests — pure logic, no React. Covers the default
 * (seed-based) behaviour, explicit tenant-setting overrides, and the
 * vocabulary-drift / compare-tolerance edge cases, mirroring the reference
 * pages/candidates/lib/vacancyTabVisibility.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { getCandidateTabDefaults, isCandidateTabVisible } from './candidateTabVisibility'

// Minimal lookup fixtures mirroring the real DEFAULT_VACANCY_STATUSES / DEFAULT_STATUSES seed shape.
const vacancyStatuses = [
  { value: 'open',    label: 'Open' },
  { value: 'online',  label: 'Online' },
  { value: 'concept', label: 'Concept' },
  { value: 'paused',  label: 'Gepauzeerd' },
  { value: 'closed',  label: 'Gesloten' },
]
const candidateStatuses = [
  { value: 'available',   label: 'Beschikbaar' },
  { value: 'placed',      label: 'Geplaatst' },
  { value: 'unavailable', label: 'Niet beschikbaar' },
  { value: 'sick',        label: 'Ziek' },
  { value: 'leave',       label: 'Verlof' },
]
const candidateTypes = [
  { value: 'freelance',   label: 'ZZP' },
  { value: 'temp_agency', label: 'Uitzendkracht' },
]

describe('getCandidateTabDefaults', () => {
  // The seed default is every current vacancy status (tab visible everywhere).
  it('defaults vacancy_statuses to every current tenant vacancy status', () => {
    const d = getCandidateTabDefaults(vacancyStatuses, candidateStatuses, candidateTypes)
    expect(d.vacancy_statuses).toEqual(['open', 'online', 'concept', 'paused', 'closed'])
  })
  // The status reading as "available" preselects the candidate filter — a
  // EXACT match: "unavailable"/"Niet beschikbaar" must NOT ride along (that
  // substring quirk preselected the opposite of the intended default, 23-07).
  it('preselects only the exactly-"available" status — never unavailable/sick/leave', () => {
    const d = getCandidateTabDefaults(vacancyStatuses, candidateStatuses, candidateTypes)
    expect(d.candidate_statuses).toEqual(['available'])
  })
  // No contract-form restriction by default — nothing preselected means all candidates.
  it('defaults contract_forms to an empty (unrestricted) array', () => {
    const d = getCandidateTabDefaults(vacancyStatuses, candidateStatuses, candidateTypes)
    expect(d.contract_forms).toEqual([])
  })
})

describe('isCandidateTabVisible — no tenant setting (defaults apply)', () => {
  it('shows for any current vacancy status (default = every status allowed)', () => {
    expect(isCandidateTabVisible(null, { status: 'concept' }, vacancyStatuses)).toBe(true)
  })
  it('shows when the vacancy has no status yet', () => {
    expect(isCandidateTabVisible(null, { status: null }, vacancyStatuses)).toBe(true)
  })
})

describe('isCandidateTabVisible — explicit tenant config overrides the default', () => {
  it('an explicit empty vacancy_statuses array hides the tab everywhere', () => {
    expect(isCandidateTabVisible({ vacancy_statuses: [] }, { status: 'open' }, vacancyStatuses)).toBe(false)
  })
  it('an explicit allow-list excludes a status not in it', () => {
    expect(isCandidateTabVisible({ vacancy_statuses: ['open', 'online'] }, { status: 'closed' }, vacancyStatuses)).toBe(false)
  })
  it('an explicit allow-list includes a status that is in it', () => {
    expect(isCandidateTabVisible({ vacancy_statuses: ['open', 'online'] }, { status: 'open' }, vacancyStatuses)).toBe(true)
  })
})

describe('isCandidateTabVisible — vocabulary drift & compare tolerance', () => {
  it('a status value not in the tenant lookup (renamed/removed) stays visible', () => {
    expect(isCandidateTabVisible({ vacancy_statuses: ['open'] }, { status: 'archived' }, vacancyStatuses)).toBe(true)
  })
  it('compares case- and whitespace-tolerantly', () => {
    expect(isCandidateTabVisible({ vacancy_statuses: ['open'] }, { status: ' OPEN ' }, vacancyStatuses)).toBe(true)
    expect(isCandidateTabVisible({ vacancy_statuses: ['open'] }, { status: ' Closed ' }, vacancyStatuses)).toBe(false)
  })
  it('an empty/missing vacancy status never blocks visibility, even with an explicit empty allow-list', () => {
    expect(isCandidateTabVisible({ vacancy_statuses: [] }, { status: undefined }, vacancyStatuses)).toBe(true)
  })
})
