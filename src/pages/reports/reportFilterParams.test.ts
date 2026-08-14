import { describe, it, expect } from 'vitest'
import { buildReportQueryParams, isFilterableReport, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'

// The reports right-panel today offers a working period filter for every report,
// plus real server-side dimensions for the two reports the backend resolver is
// wired to (candidates/customers, RAPPORT-FILTERS-1). The helper must reflect
// exactly that contract, and nothing more, so a future filter group can never
// leak an unsupported param to an unwired `/reports/*` call.
describe('buildReportQueryParams', () => {
  it('returns only the period param when no report id is given', () => {
    expect(buildReportQueryParams('day')).toEqual({ period: 'day' })
    expect(buildReportQueryParams('week')).toEqual({ period: 'week' })
    expect(buildReportQueryParams('month')).toEqual({ period: 'month' })
  })

  it('never includes any key beyond period for an unfilterable report', () => {
    const filters: ReportFilterState = { status: ['open'], ownerId: ['u1'], locationId: ['l1'] }
    const params = buildReportQueryParams('month', 'flow', filters)
    expect(Object.keys(params)).toEqual(['period'])
  })

  it('attaches status/owner_id/location_id for candidates', () => {
    const filters: ReportFilterState = { status: ['available'], ownerId: ['u1', 'u2'], locationId: [7] }
    expect(buildReportQueryParams('month', 'candidates', filters)).toEqual({
      period: 'month', status: ['available'], owner_id: ['u1', 'u2'], location_id: [7],
    })
  })

  it('attaches status/owner_id/location_id for customers', () => {
    const filters: ReportFilterState = { status: ['active'], ownerId: ['u3'], locationId: [] }
    expect(buildReportQueryParams('week', 'customers', filters)).toEqual({
      period: 'week', status: ['active'], owner_id: ['u3'],
    })
  })

  it('omits empty dimensions rather than sending empty arrays', () => {
    expect(buildReportQueryParams('month', 'candidates', EMPTY_REPORT_FILTERS)).toEqual({ period: 'month' })
  })
})

describe('isFilterableReport', () => {
  it('is true only for candidates and customers', () => {
    expect(isFilterableReport('candidates')).toBe(true)
    expect(isFilterableReport('customers')).toBe(true)
    expect(isFilterableReport('flow')).toBe(false)
    expect(isFilterableReport(undefined)).toBe(false)
  })
})
