/**
 * vacancySearchFilters — the pure client-side narrowing rules behind the
 * candidate's vacancy search. One rule governs all three: a row is never excluded
 * for data it does not carry.
 */
import { describe, it, expect } from 'vitest'
import { matchesContractForm } from './vacancySearchFilters'
import type { VacancySearchRow } from './vacancySearchFilters'


// The "geen vacatures gevonden" regression (Danny 09-08). The server answered with
// nine real matches and the screen showed none, because every vacancy had an empty
// contract form while the filter had auto-seeded the candidate's own three. A filter
// must never exclude a row for a value that row simply does not carry.
describe('matchesContractForm — a missing contract form never excludes', () => {
  const row = (employmentType: string | null) => ({ employmentType } as VacancySearchRow)

  it('keeps a vacancy that carries no contract form at all', () => {
    expect(matchesContractForm(row(null), ['ZZP', 'Uitzendkracht', 'Detachering'])).toBe(true)
    expect(matchesContractForm(row(''), ['ZZP'])).toBe(true)
  })

  it('still narrows on vacancies that DO carry one', () => {
    expect(matchesContractForm(row('ZZP'), ['ZZP'])).toBe(true)
    expect(matchesContractForm(row('Oproepkracht'), ['ZZP'])).toBe(false)
  })

  it('keeps everything when nothing is selected', () => {
    expect(matchesContractForm(row('Oproepkracht'), [])).toBe(true)
    expect(matchesContractForm(row(null), [])).toBe(true)
  })
})
