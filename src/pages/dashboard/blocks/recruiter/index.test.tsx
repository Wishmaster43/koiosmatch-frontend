/**
 * RECRUITER_TILES registry — hasData is false on an absent/empty feed and true
 * once the feed carries data, per entry; the recruiter-load + fill-rate PAIR
 * (DASH-PAIRS-1, Danny 25-08) stays first and keeps both tiles together.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: () => '25-08-2026' }) }))
vi.mock('@/lib/useAppointmentTypes', () => ({ useAppointmentTypes: () => ({ metaOf: () => undefined }) }))

import { RECRUITER_TILES } from './index'

// Every leaf tile, pairs flattened.
const leaves = RECRUITER_TILES.flatMap(e => e.children ?? [e])

describe('RECRUITER_TILES', () => {
  it('opens with the recruiter-load + fill-rate pair, in that order', () => {
    expect(RECRUITER_TILES[0].children?.map(c => c.blockId)).toEqual(['block.recruiterLoad', 'block.fillRateTimeseries'])
  })

  it('self-hides every entry on an absent/empty feed', () => {
    for (const entry of RECRUITER_TILES) {
      expect(entry.hasData({})).toBe(false)
      expect(entry.hasData({ [entry.feedKey]: [] })).toBe(false)
    }
  })

  it('shows tasks_due_today, appointments_next_48h, redeploy_radar, productivity_by_recruiter and recruiter_load on data', () => {
    const dataByKey: Record<string, unknown> = {
      tasks_due_today: [{ task_id: 't1', title: 'x', priority: null, due_time: null, assignee_id: null, assignee: null }],
      appointments_next_48h: [{ appointment_id: 'a1', candidate_id: 'c1', candidate: null, scheduled_at: '2026-08-25T10:00:00Z', type: 'x', application_id: null }],
      redeploy_radar: [{ candidate_id: 'c1', candidate: null, match_id: 'm1', customer: null, end_date: '2026-08-30', days_left: 5 }],
      productivity_by_recruiter: [{ user_id: 'u1', name: 'Anna', proposals: 1, placements: 1 }],
      recruiter_load: [{ user_id: 'u1', name: 'Anna', open_tasks: 3, intakes_planned: 1, too_long_in_stage: 0 }],
    }
    for (const entry of leaves) {
      if (entry.feedKey in dataByKey) {
        expect(entry.hasData({ [entry.feedKey]: dataByKey[entry.feedKey] })).toBe(true)
      }
    }
  })

  it('the pair shows when only one side has data (the other side simply stays away)', () => {
    const pair = RECRUITER_TILES[0]
    expect(pair.hasData({ recruiter_load: [{ user_id: 'u1', name: 'Anna', open_tasks: 3, intakes_planned: 1, too_long_in_stage: 0 }] })).toBe(true)
    expect(pair.hasData({ fill_rate_timeseries: [{ date: '2026-08-25', total: 10, filled: 8, rate: 80 }] })).toBe(true)
  })

  it('fill_rate_timeseries requires at least one non-null rate', () => {
    const entry = leaves.find(e => e.feedKey === 'fill_rate_timeseries')!
    expect(entry.hasData({ fill_rate_timeseries: [{ date: '2026-08-25', total: 0, filled: 0, rate: null }] })).toBe(false)
    expect(entry.hasData({ fill_rate_timeseries: [{ date: '2026-08-25', total: 10, filled: 8, rate: 80 }] })).toBe(true)
  })
})
