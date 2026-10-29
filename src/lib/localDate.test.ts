import { describe, it, expect } from 'vitest'
import { formatHoursSince } from './localDate'

// Stub t echoes key and count so the branch taken is visible.
const t = (k: string, o?: Record<string, unknown>) => `${k}|${o?.count}`
const now = new Date('2026-10-29T12:00:00Z')
const ago = (h: number, m = 0) => new Date(now.getTime() - (h * 60 + m) * 60000)

describe('formatHoursSince', () => {
  it('renders hours under 48h', () => {
    expect(formatHoursSince(ago(47, 59), now, t)).toBe('common:duration.hoursShort|47')
    expect(formatHoursSince(ago(0), now, t)).toBe('common:duration.hoursShort|0')
  })
  it('switches to days at exactly 48h and floors', () => {
    expect(formatHoursSince(ago(48), now, t)).toBe('common:duration.daysShort|2')
    expect(formatHoursSince(ago(73), now, t)).toBe('common:duration.daysShort|3')
  })
  it('returns null for future, invalid or missing dates', () => {
    expect(formatHoursSince(new Date(now.getTime() + 3600000), now, t)).toBeNull()
    expect(formatHoursSince('nope', now, t)).toBeNull()
    expect(formatHoursSince(null, now, t)).toBeNull()
    expect(formatHoursSince(undefined, now, t)).toBeNull()
  })
})
