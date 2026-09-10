/**
 * liteRecordHeader — behaviour: the candidate-name fallback chain, the vacancy-
 * title fallback and the derived initials, shared by useApplicationLite and
 * useMatchLite (DRY round 11, DRAWERS).
 */
import { describe, it, expect } from 'vitest'
import { liteRecordHeader } from './liteHeader'

describe('liteRecordHeader', () => {
  it('prefers candidate.name over first_name+last_name over candidate_name', () => {
    const withName = liteRecordHeader({ id: 1, candidate: { name: 'Jan de Vries', first_name: 'Jan', last_name: 'de Vries' }, candidate_name: 'ignored' })
    expect(withName.candidateName).toBe('Jan de Vries')
    expect(withName.initials).toBe('JD')

    const withoutName = liteRecordHeader({ id: 2, candidate: { first_name: 'Anna', last_name: 'Bakker' } })
    expect(withoutName.candidateName).toBe('Anna Bakker')

    const flat = liteRecordHeader({ id: 3, candidate_name: 'Piet Jansen' })
    expect(flat.candidateName).toBe('Piet Jansen')
  })

  it('falls back to "?" when no candidate identity is present at all', () => {
    expect(liteRecordHeader({ id: 4 }).candidateName).toBe('?')
  })

  it('reads vacancy.title before the flat vacancy_title, and stringifies id', () => {
    const nested = liteRecordHeader({ id: 5, vacancy: { title: 'Logistiek medewerker' }, vacancy_title: 'ignored' })
    expect(nested.vacancyTitle).toBe('Logistiek medewerker')
    expect(nested.id).toBe('5')

    const flat = liteRecordHeader({ id: 6, vacancy_title: 'Chauffeur' })
    expect(flat.vacancyTitle).toBe('Chauffeur')
  })
})
