import { describe, it, expect } from 'vitest'
import { deriveVacancyAdvice } from './vacancyAdvice'
import type { Vacancy } from '@/types/vacancy'

const NOW = new Date('2026-08-04T12:00:00Z')

function makeVacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 'v1', published: true, archived: false, applicationsCount: 0,
    created: '2026-07-01', createdSort: '2026-07-01', ...overrides,
  } as unknown as Vacancy
}

describe('deriveVacancyAdvice', () => {
  it('advises attention when published, zero applications and past the stale threshold', () => {
    const rule = deriveVacancyAdvice(makeVacancy(), { staleDays: 14, now: NOW })
    expect(rule.action).toBe('attention')
    expect(rule.reasonParams?.days).toBeGreaterThanOrEqual(14)
  })

  it('advises nothing when it already has applications', () => {
    const rule = deriveVacancyAdvice(makeVacancy({ applicationsCount: 3 }), { staleDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('advises nothing when still within the stale window', () => {
    const rule = deriveVacancyAdvice(makeVacancy({ created: '2026-08-01', createdSort: '2026-08-01' }), { staleDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on an unpublished (draft) vacancy — an empty pipeline is expected', () => {
    const rule = deriveVacancyAdvice(makeVacancy({ published: false }), { staleDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on an archived vacancy', () => {
    const rule = deriveVacancyAdvice(makeVacancy({ archived: true }), { staleDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })
})

// Wave-2 clock parity: a vacancy created long ago but (re)published RECENTLY is
// not stale — the server counts from COALESCE(published_at, created_at) and so do we.
it('measures staleness from publishedAt when present, falling back to created', () => {
  const now = new Date('2026-08-13T12:00:00Z')
  const old = '2026-01-01T00:00:00Z'
  const fresh = '2026-08-12T00:00:00Z'
  const base = { archived: false, published: true, applicationsCount: 0, created: old, createdSort: old }
  // Republished yesterday → 1 day old → below any sane threshold: no advice.
  expect(deriveVacancyAdvice({ ...base, publishedAt: fresh } as never, { staleDays: 7, now }).action).toBe('none')
  // Never published-stamped → falls back to created → stale.
  expect(deriveVacancyAdvice({ ...base, publishedAt: null } as never, { staleDays: 7, now }).action).toBe('attention')
})
