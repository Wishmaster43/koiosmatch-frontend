import { describe, it, expect } from 'vitest'
import { buildReportQueryParams } from './reportFilterParams'

// The reports right-panel today only offers a working period filter — the
// helper must reflect exactly that contract, and nothing more, so a future
// filter group can never leak an unsupported param to a `/reports/*` call.
describe('buildReportQueryParams', () => {
  it('returns only the period param', () => {
    expect(buildReportQueryParams('day')).toEqual({ period: 'day' })
    expect(buildReportQueryParams('week')).toEqual({ period: 'week' })
    expect(buildReportQueryParams('month')).toEqual({ period: 'month' })
  })

  it('never includes any key beyond period', () => {
    const params = buildReportQueryParams('month')
    expect(Object.keys(params)).toEqual(['period'])
  })
})
