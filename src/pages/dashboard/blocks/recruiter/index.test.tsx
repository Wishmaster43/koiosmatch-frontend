/**
 * RECRUITER_TILES registry — hasData is false on an absent/empty feed and true
 * once the feed carries data, per entry.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: () => '25-08-2026' }) }))
vi.mock('@/lib/useAppointmentTypes', () => ({ useAppointmentTypes: () => ({ metaOf: () => undefined }) }))

import { RECRUITER_TILES } from './index'

describe('RECRUITER_TILES', () => {
  it('self-hides every entry on an absent/empty feed', () => {
    for (const entry of RECRUITER_TILES) {
      expect(entry.hasData({})).toBe(false)
      expect(entry.hasData({ [entry.feedKey]: [] })).toBe(false)
    }
  })

  it('shows tasks_due_today, appointments_next_48h, redeploy_radar and productivity_by_recruiter on data', () => {
    const dataByKey: Record<string, unknown> = {
      tasks_due_today: [{ task_id: 't1', title: 'x', priority: null, due_time: null, assignee_id: null, assignee: null }],
      appointments_next_48h: [{ appointment_id: 'a1', candidate_id: 'c1', candidate: null, scheduled_at: '2026-08-25T10:00:00Z', type: 'x', application_id: null }],
      redeploy_radar: [{ candidate_id: 'c1', candidate: null, match_id: 'm1', customer: null, end_date: '2026-08-30', days_left: 5 }],
      productivity_by_recruiter: [{ user_id: 'u1', name: 'Anna', proposals: 1, placements: 1 }],
    }
    for (const entry of RECRUITER_TILES) {
      if (entry.feedKey in dataByKey) {
        expect(entry.hasData({ [entry.feedKey]: dataByKey[entry.feedKey] })).toBe(true)
      }
    }
  })

  it('fill_rate_timeseries requires at least one non-null rate', () => {
    const entry = RECRUITER_TILES.find(e => e.feedKey === 'fill_rate_timeseries')!
    expect(entry.hasData({ fill_rate_timeseries: [{ date: '2026-08-25', total: 0, filled: 0, rate: null }] })).toBe(false)
    expect(entry.hasData({ fill_rate_timeseries: [{ date: '2026-08-25', total: 10, filled: 8, rate: 80 }] })).toBe(true)
  })
})
