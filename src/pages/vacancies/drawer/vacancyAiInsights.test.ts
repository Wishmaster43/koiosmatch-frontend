import { describe, it, expect } from 'vitest'
import { buildVacancyAdviceInsights } from './vacancyAiInsights'
import type { VacancyDetail } from '@/types/vacancy'

// Fake translate: returns the bare key, or "key|{...opts}" when interpolated —
// enough to assert both the branch taken and the values passed in.
const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}|${JSON.stringify(opts)}` : key)

// Minimal VacancyDetail stub — only the fields the builder reads.
const base = (over: Partial<VacancyDetail> = {}) => ({
  description: '', salaryMin: '', salaryMax: '', salary: '', hoursMin: '', hoursMax: '', hours: '',
  skills: [], street: '', city: '', location: '', statusValue: '',
  created: '', applicationsCount: 0,
  ...over,
} as unknown as VacancyDetail)

describe('buildVacancyAdviceInsights', () => {
  it('reports a low completeness % when every measured field is empty', () => {
    const [completeness] = buildVacancyAdviceInsights(base(), t)
    expect(completeness.text).toBe('ai.completePartial|{"pct":0}')
    expect(completeness.color).toBe('var(--color-warning)')
  })

  it('reports 100% completeness once every measured field is filled', () => {
    const full = base({
      description: 'Beschrijving', salaryMin: '2000', salaryMax: '2500',
      hoursMin: '24', hoursMax: '36', skills: ['BIG-geregistreerd'],
      street: 'Kerkstraat', city: 'Utrecht', statusValue: 'open',
    })
    const [completeness] = buildVacancyAdviceInsights(full, t)
    expect(completeness.text).toBe('ai.completeGood')
    expect(completeness.color).toBe('var(--color-success)')
  })

  it('never invents an opening date and never leaks NaN into the copy', () => {
    const [, flow] = buildVacancyAdviceInsights(base({ applicationsCount: 3 }), t)
    expect(flow.text).toBe('ai.flowUnknown|{"count":3}')
    expect(flow.text).not.toContain('NaN')
  })

  it('reports days open + application count when a created date is present', () => {
    const now = new Date('2026-07-14T00:00:00Z')
    const v = base({ created: '2026-07-01T00:00:00Z', applicationsCount: 5 })
    const [, flow] = buildVacancyAdviceInsights(v, t, now)
    expect(flow.text).toBe('ai.flowOpen|{"days":13,"count":5}')
  })
})
