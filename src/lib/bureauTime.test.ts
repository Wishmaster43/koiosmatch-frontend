import { describe, it, expect, afterEach } from 'vitest'
import { setBureauTimezone, getBureauTimezone, bureauToday, bureauNow } from './bureauTime'

// BUREAU-KLOK-FE-1: day boundaries the FE sends as filters must be computed in
// the BUREAU zone (K-174: the server reads date-only strings in that zone).
// These pins use explicit instants + explicit zones, so they hold in every
// process timezone — the module must never fall back to browser-local fields.
describe('bureauTime — boundaries follow the bureau zone, never the browser', () => {
  afterEach(() => setBureauTimezone('Europe/Amsterdam'))

  it('defaults to the platform zone and only accepts a real value', () => {
    expect(getBureauTimezone()).toBe('Europe/Amsterdam')
    setBureauTimezone(null)
    setBureauTimezone(undefined)
    setBureauTimezone('')
    expect(getBureauTimezone()).toBe('Europe/Amsterdam')
    setBureauTimezone('Europe/London')
    expect(getBureauTimezone()).toBe('Europe/London')
  })

  it('bureauToday returns the BUREAU calendar day around midnight, both directions', () => {
    // 23:30 UTC in summer = 01:30 next day in Amsterdam (UTC+2).
    setBureauTimezone('Europe/Amsterdam')
    expect(bureauToday(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01')
    // The same instant is still 19:30 the SAME day in New York (UTC-4) —
    // exactly the off-by-one a browser there used to send.
    setBureauTimezone('America/New_York')
    expect(bureauToday(new Date('2026-06-30T23:30:00Z'))).toBe('2026-06-30')
  })

  it('bureauNow carries the bureau-zone calendar fields for local-getter math', () => {
    setBureauTimezone('Europe/Amsterdam')
    const d = bureauNow(new Date('2026-06-30T23:30:00Z'))
    // The FIELDS are the bureau's (1 July, 01:30) — the instant is deliberately
    // synthetic; callers only do setDate/setMonth + toLocalIsoDate on it.
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 7, 1, 1, 30])
  })

  it('bureauNow normalises an hour-24 midnight rendering to 0', () => {
    setBureauTimezone('UTC')
    const d = bureauNow(new Date('2026-06-30T00:00:00Z'))
    expect(d.getHours()).toBe(0)
    expect(d.getDate()).toBe(30)
  })
})
