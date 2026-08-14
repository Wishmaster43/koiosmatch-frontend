/**
 * scheduleLabel · WORKFLOW-SCHEMA-1 — the example line must render the exact
 * reference wording per frequency (Danny's own formulation, nl locale), built
 * straight from the backend contract's own trigger_config keys (frequency /
 * times / weekdays / monthday / month / interval_minutes). Also covers the
 * three legacy shapes that must keep reading correctly without ever being
 * migrated on the wire.
 */
import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'
import { scheduleLabel } from './scheduleLabel'

// Real nl strings, fixed to the workflows namespace (mirrors DrawerAddButton.test.tsx's cm() helper).
const t = i18n.getFixedT('nl', 'workflows') as never
const tr = (cfg: Record<string, unknown>) => scheduleLabel(t, 'nl', 'Scheduled', cfg)

describe('scheduleLabel · reference wording per frequency (nl)', () => {
  it('daily, one time', () => {
    expect(tr({ frequency: 'daily', times: ['09:00'] })).toBe('Dagelijks 09:00')
  })

  it('daily, multiple times', () => {
    expect(tr({ frequency: 'daily', times: ['06:00', '13:00'] })).toBe('Dagelijks 06:00, 13:00')
  })

  it('weekly, multiple weekdays (ISO, Monday=1)', () => {
    expect(tr({ frequency: 'weekly', weekdays: [1, 4], times: ['09:00'] })).toBe('Wekelijks (ma, do) 09:00')
  })

  it('monthly', () => {
    expect(tr({ frequency: 'monthly', monthday: 31, times: ['09:00'] })).toBe('Maandelijks dag 31 09:00')
  })

  it('quarterly', () => {
    expect(tr({ frequency: 'quarterly', monthday: 1, times: ['09:00'] })).toBe('Per kwartaal dag 1 09:00')
  })

  it('yearly', () => {
    expect(tr({ frequency: 'yearly', month: 2, monthday: 1, times: ['09:00'] })).toBe('Jaarlijks 2-1 09:00')
  })

  it('interval', () => {
    expect(tr({ frequency: 'interval', interval_minutes: 30 })).toBe('Elke 30 min')
  })
})

describe('scheduleLabel · legacy shapes (never migrated on the wire)', () => {
  it('a single schedule_time with no frequency reads as daily', () => {
    expect(tr({ schedule_time: '07:30' })).toBe('Dagelijks 07:30')
  })

  it('a single legacy `time` with no frequency reads as daily', () => {
    expect(tr({ time: '07:30' })).toBe('Dagelijks 07:30')
  })

  it('a bare `times` array with no frequency reads as daily', () => {
    expect(tr({ times: ['06:00', '18:00'] })).toBe('Dagelijks 06:00, 18:00')
  })

  it('schedule: "weekly" + an ISO day number', () => {
    expect(tr({ schedule: 'weekly', day: 4, time: '09:00' })).toBe('Wekelijks (do) 09:00')
  })

  it('schedule: "weekly" + an English weekday name', () => {
    expect(tr({ schedule: 'weekly', day: 'monday', time: '09:00' })).toBe('Wekelijks (ma) 09:00')
  })
})
