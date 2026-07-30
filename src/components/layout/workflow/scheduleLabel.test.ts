/**
 * scheduleLabel · daily frequency — regression test for the singular/plural
 * mismatch: `useScheduleForm` saves a daily schedule as `cfg.times` (an array,
 * one entry per run), never `cfg.time`. Reading `cfg.time` here always fell
 * back to the '08:00' default, so BOTH the trigger button and the live preview
 * lied about the actually-configured times (BUG 1).
 */
import { describe, it, expect } from 'vitest'
import { scheduleLabel } from './scheduleLabel'

// t() is uninitialized in this pure-function test — it returns the key itself,
// mirroring the existing ScheduleModal.test.tsx convention.
const t = ((key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key)) as never

describe('scheduleLabel · daily frequency', () => {
  it('reads the saved cfg.times array, not the unused cfg.time singular', () => {
    const label = scheduleLabel(t, 'nl', 'Scheduled', { schedule_type: 'daily', times: ['09:15'] })
    expect(label).toContain('09:15')
    expect(label).not.toContain('08:00')
  })

  it('joins every configured time when there is more than one run per day', () => {
    const label = scheduleLabel(t, 'nl', 'Scheduled', { schedule_type: 'daily', times: ['06:00', '13:30', '20:00'] })
    expect(label).toContain('06:00, 13:30, 20:00')
  })

  it('falls back to 08:00 only for a malformed/legacy cfg with no times at all', () => {
    const label = scheduleLabel(t, 'nl', 'Scheduled', { schedule_type: 'daily' })
    expect(label).toContain('08:00')
  })
})
