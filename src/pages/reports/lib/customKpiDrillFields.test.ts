/**
 * CUSTOM_KPI_DRILL_FIELDS / pickDrillFields — the per-entity field lists and the
 * present-values picker used by the shared drill drawer (wired in batch E).
 */
import { describe, it, expect } from 'vitest'
import { CUSTOM_KPI_DRILL_FIELDS, pickDrillFields } from './customKpiDrillFields'

describe('CUSTOM_KPI_DRILL_FIELDS', () => {
  it('carries the exact field list per entity from the plan', () => {
    expect(CUSTOM_KPI_DRILL_FIELDS.match).toEqual(['client', 'status', 'end_date'])
    expect(CUSTOM_KPI_DRILL_FIELDS.candidate).toEqual(['status', 'function_title', 'city'])
    expect(CUSTOM_KPI_DRILL_FIELDS.application).toEqual(['stage', 'client'])
    expect(CUSTOM_KPI_DRILL_FIELDS.task).toEqual(['status', 'assignee'])
    expect(CUSTOM_KPI_DRILL_FIELDS.vacancy).toEqual(['client', 'status'])
    expect(CUSTOM_KPI_DRILL_FIELDS.opportunity).toEqual(['customer', 'status'])
    expect(CUSTOM_KPI_DRILL_FIELDS.outreach).toEqual(['status', 'assignee'])
    expect(CUSTOM_KPI_DRILL_FIELDS.whatsapp).toEqual(['wa_number'])
    expect(CUSTOM_KPI_DRILL_FIELDS.customer).toEqual(['status', 'city'])
  })

  it('has no entry for an unknown entity', () => {
    expect(CUSTOM_KPI_DRILL_FIELDS.unknown_entity).toBeUndefined()
  })
})

describe('pickDrillFields', () => {
  it('returns present values in field order', () => {
    const row = { client: 'Acme', status: 'active', end_date: '2026-09-30', extra: 'ignored' }
    expect(pickDrillFields(row, ['client', 'status', 'end_date'])).toEqual(['Acme', 'active', '2026-09-30'])
  })

  it('skips null/undefined fields without leaving gaps', () => {
    const row = { client: 'Acme', status: null, end_date: undefined }
    expect(pickDrillFields(row, ['client', 'status', 'end_date'])).toEqual(['Acme'])
  })

  it('returns an empty array when no field is present', () => {
    expect(pickDrillFields({}, ['status', 'assignee'])).toEqual([])
  })
})
