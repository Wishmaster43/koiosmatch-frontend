/** Pins the tolerant Koios report normalizers: {} never throws, partial shapes are defaulted, full shapes pass through. */
import { describe, it, expect } from 'vitest'
import { normalizeForYouReport, normalizePerformanceReport } from './normalizeKoiosReports'

describe('normalizeForYouReport', () => {
  it('turns an empty object, null and garbage into the empty report', () => {
    for (const raw of [{}, null, undefined, 'x', []]) {
      const r = normalizeForYouReport(raw)
      expect(r).toMatchObject({ actions_total: 0, per_type: {}, per_source: {}, actions: [], actions_truncated: false })
    }
  })
  it('defaults the missing parts of a partial shape', () => {
    const r = normalizeForYouReport({ actions_total: '4', per_type: { a: 4 }, actions: [{ type: 'a' }, null] })
    expect(r.actions_total).toBe(4)
    expect(r.per_type).toEqual({ a: 4 })
    expect(r).toEqual({
      from: undefined, to: undefined, period: '', actions_total: 4, per_type: { a: 4 }, per_source: {}, actions_truncated: false,
      actions: [{ id: 'missing-0', type: 'a', source: '', executed_at: null, status: '', created: null }],
    })
  })
  it('keeps a full shape unchanged', () => {
    const full = {
      from: '2026-08-24', to: '2026-08-26', period: 'range', actions_total: 2,
      per_type: { koios_create_task: 2 }, per_source: { note: 2 },
      actions: [{ id: 'x', type: 'koios_create_task', source: 'note', executed_at: '2026-08-25T10:00:00Z', status: 'completed', created: { entity_type: 'task', entity_id: 't1', label: 'Call' } }],
      actions_truncated: true,
    }
    expect(normalizeForYouReport(full)).toEqual(full)
  })
})

describe('normalizePerformanceReport', () => {
  it('turns {} into zeroed tiles and empty lists', () => {
    expect(normalizePerformanceReport({})).toEqual({ executed: { completed: 0, failed: 0, other: 0 }, top_users: [], timeseries: [] })
  })
  it('defaults a partial shape and keeps a full one', () => {
    expect(normalizePerformanceReport({ executed: { failed: 2 } })).toEqual({ executed: { completed: 0, failed: 2, other: 0 }, top_users: [], timeseries: [] })
    const full = { executed: { completed: 5, failed: 3, other: 1 }, top_users: [{ user_id: 'u1', name: 'Danny', count: 8 }], timeseries: [{ date: '2026-08-23', count: 8 }] }
    expect(normalizePerformanceReport(full)).toEqual(full)
  })
})
