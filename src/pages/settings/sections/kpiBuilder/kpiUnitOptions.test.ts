import { describe, expect, it } from 'vitest'
import { DAY_KINDS, UNIT_LABEL_KEY, unitOptionsFor } from './kpiUnitOptions'
import type { KpiUnit } from './kpiDefinitionsApi'

// Duration kinds fan out to every duration unit, in a fixed order.
describe('unitOptionsFor', () => {
  it('avg_workdays returns the four duration units in order', () => {
    expect(unitOptionsFor('avg_workdays', 'days')).toEqual(['days', 'workdays', 'weeks', 'months'])
  })

  it('avg_days also returns the four duration units', () => {
    expect(unitOptionsFor('avg_days', 'workdays')).toEqual(['days', 'workdays', 'weeks', 'months'])
  })

  it('a non-duration kind locks to its own default unit', () => {
    expect(unitOptionsFor('percent', 'percent')).toEqual(['percent'])
    expect(unitOptionsFor('count', 'count')).toEqual(['count'])
  })

  it('DAY_KINDS names exactly the two duration kinds', () => {
    expect(DAY_KINDS).toEqual(['avg_days', 'avg_workdays'])
  })
})

describe('UNIT_LABEL_KEY', () => {
  it('every KpiUnit has a label key', () => {
    const units: KpiUnit[] = ['count', 'percent', 'currency', 'hours', 'minutes', 'days', 'workdays', 'weeks', 'months']
    for (const u of units) expect(UNIT_LABEL_KEY[u]).toBeTruthy()
  })
})
