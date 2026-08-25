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
    expect(isFilterableReport('opportunities')).toBe(true)
    expect(isFilterableReport('outreach')).toBe(true)
    expect(isFilterableReport('whatsapp')).toBe(true)
    expect(isFilterableReport('flow')).toBe(false)
    expect(isFilterableReport(undefined)).toBe(false)
  })
})

// WAVE 1c: PLAN-RAPPORTEN-V3 §a's per-page dimensions, each gated to the exact
// report whose segmentQuery() reads it (koiosmatch-api AppliesReportFilters.php
// extraDimensionRules() + verified per-report app/Services/Report/*.php).
describe('buildReportQueryParams — WAVE 1c per-page dimensions', () => {
  it('attaches source/phase/contract_form for candidates only', () => {
    const filters: ReportFilterState = { ...EMPTY_REPORT_FILTERS, source: ['Indeed'], phase: ['lead'], contractForm: ['zzp'] }
    expect(buildReportQueryParams('month', 'candidates', filters)).toEqual({
      period: 'month', source: ['Indeed'], phase: ['lead'], contract_form: ['zzp'],
    })
    expect(buildReportQueryParams('month', 'applications', { ...filters })).not.toHaveProperty('phase')
  })

  it('attaches stage/source/rejection_reason for applications', () => {
    const filters: ReportFilterState = { ...EMPTY_REPORT_FILTERS, stage: ['applied'], source: ['LinkedIn'], rejectionReason: ['r1'] }
    expect(buildReportQueryParams('month', 'applications', filters)).toEqual({
      period: 'month', stage: ['applied'], source: ['LinkedIn'], rejection_reason: ['r1'],
    })
  })

  it('attaches customer_ids/origin/contract_form for matches (stop_reason stays off: the envelope never applies it)', () => {
    const filters: ReportFilterState = { ...EMPTY_REPORT_FILTERS, customerIds: ['c1'], origin: ['funnel'], contractForm: ['zzp'] }
    expect(buildReportQueryParams('month', 'matches', filters)).toEqual({
      period: 'month', customer_ids: ['c1'], origin: ['funnel'], contract_form: ['zzp'],
    })
  })

  it('attaches type/priority/team_id for tasks', () => {
    const filters: ReportFilterState = { ...EMPTY_REPORT_FILTERS, taskType: ['t1'], priority: ['p1'], teamId: ['team1'] }
    expect(buildReportQueryParams('month', 'tasks', filters)).toEqual({
      period: 'month', type: ['t1'], priority: ['p1'], team_id: ['team1'],
    })
  })

  it('attaches direction/escalated for whatsapp, and drops status/location_id even when set', () => {
    const filters: ReportFilterState = { ...EMPTY_REPORT_FILTERS, status: ['x'], locationId: ['l1'], direction: ['inbound'], escalated: true }
    expect(buildReportQueryParams('month', 'whatsapp', filters)).toEqual({
      period: 'month', direction: ['inbound'], escalated: true,
    })
  })

  it('attaches value_min/value_max for opportunities', () => {
    const filters: ReportFilterState = { ...EMPTY_REPORT_FILTERS, valueMin: 100, valueMax: 500 }
    expect(buildReportQueryParams('month', 'opportunities', filters)).toEqual({
      period: 'month', value_min: 100, value_max: 500,
    })
  })

  it('outreach carries no per-page dimension beyond status/owner_id/location_id', () => {
    const filters: ReportFilterState = { ...EMPTY_REPORT_FILTERS, status: ['todo'], ownerId: ['u1'], locationId: ['l1'] }
    expect(buildReportQueryParams('month', 'outreach', filters)).toEqual({
      period: 'month', status: ['todo'], owner_id: ['u1'], location_id: ['l1'],
    })
  })
})
