/**
 * SALES_TILES registry — asserts every entry's hasData is false on an
 * absent/empty feed and true when the feed carries data.
 */
import { describe, it, expect } from 'vitest'
import { SALES_TILES } from './index'
import type { DashData } from '@/types/dashboard'

describe('SALES_TILES registry', () => {
  it('keeps customersByOwner first', () => {
    expect(SALES_TILES[0].blockId).toBe('block.customersByOwner')
  })

  it('registers all six sales tiles', () => {
    expect(SALES_TILES.map(e => e.feedKey)).toEqual([
      'customers_by_owner',
      'opps_by_stage_by_owner',
      'opps_stalled_list',
      'activity_by_owner',
      'pipeline_value_timeseries',
      'customers_at_risk_list',
    ])
  })

  it('each entry hasData is false on absent/empty and true on data', () => {
    const emptyDash = {} as DashData
    const fixtures: Record<string, unknown[]> = {
      customers_by_owner: [{ owner_id: '1', name: 'A', count: 1 }],
      opps_by_stage_by_owner: [{ stage_id: 's1', stage_label: 'Qualified', by_owner: [] }],
      opps_stalled_list: [{ id: 'o1', title: 'D', customer: null, owner: 'Bob', stage_label: null, days_still: 1, value: null }],
      activity_by_owner: [{ owner_id: '1', name: 'A', activity: 1 }],
      pipeline_value_timeseries: [{ date: '2026-06-01', value: 1 }],
      customers_at_risk_list: [{ id: 'c1', name: 'A', owner: 'Bob', last_contact_at: null, days_quiet: 1 }],
    }
    for (const entry of SALES_TILES) {
      expect(entry.hasData(emptyDash)).toBe(false)
      expect(entry.hasData({ ...emptyDash, [entry.feedKey]: [] } as DashData)).toBe(false)
      expect(entry.hasData({ ...emptyDash, [entry.feedKey]: fixtures[entry.feedKey] } as DashData)).toBe(true)
    }
  })
})
