/**
 * planning/index — asserts each entry's hasData is false on an empty/absent
 * feed and true once the feed carries data.
 */
import { describe, it, expect, vi } from 'vitest'
import { PLANNING_TILES } from './index'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/charts/PieChartCard', () => ({ default: () => <div /> }))
vi.mock('@/components/charts/BarChartCard', () => ({ default: () => <div /> }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))

describe('PLANNING_TILES', () => {
  it('registers all five planning tiles', () => {
    expect(PLANNING_TILES.map(t => t.feedKey)).toEqual([
      'shift_coverage_heatmap', 'open_shifts_list', 'occupancy_by_customer', 'shift_status_today', 'shifts_unconfirmed_list',
    ])
  })

  it('shift_coverage_heatmap hasData is false on absent key / all-zero cells, true when any cell has shifts', () => {
    const entry = PLANNING_TILES.find(t => t.feedKey === 'shift_coverage_heatmap')!
    expect(entry.hasData({})).toBe(false)
    expect(entry.hasData({ shift_coverage_heatmap: [] })).toBe(false)
    expect(entry.hasData({ shift_coverage_heatmap: [{ date: '2026-08-24', part: 'morning', shifts: 0, filled: 0 }] })).toBe(false)
    expect(entry.hasData({ shift_coverage_heatmap: [{ date: '2026-08-24', part: 'morning', shifts: 2, filled: 1 }] })).toBe(true)
  })

  it('open_shifts_list hasData is false on [] / absent, true on data', () => {
    const entry = PLANNING_TILES.find(t => t.feedKey === 'open_shifts_list')!
    expect(entry.hasData({})).toBe(false)
    expect(entry.hasData({ open_shifts_list: [] })).toBe(false)
    expect(entry.hasData({ open_shifts_list: [{ shift_id: 's1', start_time: '', end_time: null, order_title: null, status: 'open' }] })).toBe(true)
  })

  it('occupancy_by_customer hasData is false on [] / absent / all-null rate, true on data', () => {
    const entry = PLANNING_TILES.find(t => t.feedKey === 'occupancy_by_customer')!
    expect(entry.hasData({})).toBe(false)
    expect(entry.hasData({ occupancy_by_customer: [] })).toBe(false)
    expect(entry.hasData({ occupancy_by_customer: [{ label: 'ACME', shifts: 0, filled: 0, rate: null }] })).toBe(false)
    expect(entry.hasData({ occupancy_by_customer: [{ label: 'ACME', shifts: 1, filled: 1, rate: 100 }] })).toBe(true)
  })

  it('shift_status_today hasData is false on absent key / every count 0, true when one is non-zero', () => {
    const entry = PLANNING_TILES.find(t => t.feedKey === 'shift_status_today')!
    expect(entry.hasData({})).toBe(false)
    expect(entry.hasData({ shift_status_today: [] })).toBe(false)
    expect(entry.hasData({ shift_status_today: [{ status: 'planned', count: 0 }] })).toBe(false)
    expect(entry.hasData({ shift_status_today: [{ status: 'planned', count: 1 }] })).toBe(true)
  })

  it('shifts_unconfirmed_list hasData is false on [] / absent, true on data', () => {
    const entry = PLANNING_TILES.find(t => t.feedKey === 'shifts_unconfirmed_list')!
    expect(entry.hasData({})).toBe(false)
    expect(entry.hasData({ shifts_unconfirmed_list: [] })).toBe(false)
    expect(entry.hasData({ shifts_unconfirmed_list: [{ schedule_id: 'x', candidate_id: 'c', candidate: null, shift_start: null, order_title: null }] })).toBe(true)
  })
})
