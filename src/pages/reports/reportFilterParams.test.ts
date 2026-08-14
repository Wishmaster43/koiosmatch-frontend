import { describe, it, expect } from 'vitest'
import { buildReportQueryParams, isFilterableReport, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'

// The reports right-panel today offers a working period filter for every report,
// plus real server-side dimensions for the reports the backend resolver is wired
// to (candidates/customers/vacancies/applications/matches/tasks, RAPPORT-FILTERS-1).
// The helper must reflect exactly that contract, and nothing more, so a future
// filter group can never leak an unsupported param to an unwired `/reports/*` call.
describe('buildReportQueryParams', () => {
  it('returns only the period param when no report id is given', () => {
    expect(buildReportQueryParams('day')).toEqual({ period: 'day' })
    expect(buildReportQueryParams('week')).toEqual({ period: 'week' })
    expect(buildReportQueryParams('month')).toEqual({ period: 'month' })
  })

  it('never includes any key beyond period for an unfilterable report', () => {
    const filters: ReportFilterState = { status: ['open'], ownerId: ['u1'], locationId: ['l1'], customerId: ['c1'] }
    const params = buildReportQueryParams('month', 'flow', filters)
    expect(Object.keys(params)).toEqual(['period'])
  })

  it('attaches status/owner_id/location_id for candidates', () => {
    const filters: ReportFilterState = { status: ['available'], ownerId: ['u1', 'u2'], locationId: [7], customerId: [] }
    expect(buildReportQueryParams('month', 'candidates', filters)).toEqual({
      period: 'month', status: ['available'], owner_id: ['u1', 'u2'], location_id: [7],
    })
  })

  it('attaches status/owner_id/location_id for customers', () => {
    const filters: ReportFilterState = { status: ['active'], ownerId: ['u3'], locationId: [], customerId: [] }
    expect(buildReportQueryParams('week', 'customers', filters)).toEqual({
      period: 'week', status: ['active'], owner_id: ['u3'],
    })
  })

  it('never attaches customer_id for candidates/customers even when set (no client FK column)', () => {
    const filters: ReportFilterState = { status: [], ownerId: [], locationId: [], customerId: ['c1'] }
    expect(buildReportQueryParams('month', 'candidates', filters)).toEqual({ period: 'month' })
    expect(buildReportQueryParams('month', 'customers', filters)).toEqual({ period: 'month' })
  })

  it('attaches status/owner_id/location_id/customer_id for vacancies (client_id-backed)', () => {
    const filters: ReportFilterState = { status: ['s1'], ownerId: ['u1'], locationId: ['l1'], customerId: ['c1'] }
    expect(buildReportQueryParams('month', 'vacancies', filters)).toEqual({
      period: 'month', status: ['s1'], owner_id: ['u1'], location_id: ['l1'], customer_id: ['c1'],
    })
  })

  it('attaches status/owner_id/location_id/customer_id for applications (inherited from the vacancy)', () => {
    const filters: ReportFilterState = { status: ['active'], ownerId: ['u1'], locationId: ['l1'], customerId: ['c1'] }
    expect(buildReportQueryParams('month', 'applications', filters)).toEqual({
      period: 'month', status: ['active'], owner_id: ['u1'], location_id: ['l1'], customer_id: ['c1'],
    })
  })

  it('attaches status/owner_id/location_id for matches but NEVER customer_id (the singular key is already overloaded)', () => {
    const filters: ReportFilterState = { status: ['open'], ownerId: ['u1'], locationId: ['l1'], customerId: ['c1'] }
    expect(buildReportQueryParams('month', 'matches', filters)).toEqual({
      period: 'month', status: ['open'], owner_id: ['u1'], location_id: ['l1'],
    })
  })

  it('attaches status/owner_id/location_id for tasks but never customer_id (no customer column on tasks)', () => {
    const filters: ReportFilterState = { status: ['s1'], ownerId: ['u1'], locationId: ['l1'], customerId: ['c1'] }
    expect(buildReportQueryParams('week', 'tasks', filters)).toEqual({
      period: 'week', status: ['s1'], owner_id: ['u1'], location_id: ['l1'],
    })
  })

  it('omits empty dimensions rather than sending empty arrays', () => {
    expect(buildReportQueryParams('month', 'candidates', EMPTY_REPORT_FILTERS)).toEqual({ period: 'month' })
    expect(buildReportQueryParams('month', 'vacancies', EMPTY_REPORT_FILTERS)).toEqual({ period: 'month' })
  })
})

describe('isFilterableReport', () => {
  it('is true for every backend-wired report', () => {
    expect(isFilterableReport('candidates')).toBe(true)
    expect(isFilterableReport('customers')).toBe(true)
    expect(isFilterableReport('vacancies')).toBe(true)
    expect(isFilterableReport('applications')).toBe(true)
    expect(isFilterableReport('matches')).toBe(true)
    expect(isFilterableReport('tasks')).toBe(true)
    expect(isFilterableReport('flow')).toBe(false)
    expect(isFilterableReport(undefined)).toBe(false)
  })
})
