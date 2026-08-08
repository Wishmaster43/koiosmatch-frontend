/**
 * sessionWindow (WA-WINDOW-1) — the 24h rule the whole composer hangs on, tested
 * as pure math. The important cases are the honest ones: a payload without a
 * usable anchor is UNKNOWN, never a guessed countdown, and never silently "open".
 */
import { describe, it, expect } from 'vitest'
import { sessionWindow, windowLeftParts, SESSION_WINDOW_MS } from './sessionWindow'

const NOW = Date.parse('2026-08-08T12:00:00Z')
const isoAgo = (ms: number) => new Date(NOW - ms).toISOString()

describe('sessionWindow', () => {
  it('is open while the last inbound message is younger than 24h', () => {
    const win = sessionWindow(isoAgo(2 * 60 * 60 * 1000), NOW)
    expect(win).toMatchObject({ known: true, open: true })
    expect(win.msLeft).toBe(22 * 60 * 60 * 1000)
    expect(win.expiresAt).toBe(new Date(NOW + 22 * 60 * 60 * 1000).toISOString())
  })

  it('is closed the moment 24h have passed (no grace, mirrors the backend gate)', () => {
    expect(sessionWindow(isoAgo(SESSION_WINDOW_MS), NOW)).toMatchObject({ known: true, open: false, msLeft: 0 })
    expect(sessionWindow(isoAgo(SESSION_WINDOW_MS + 1), NOW).open).toBe(false)
  })

  it('treats a null anchor as KNOWN and closed — no inbound message ever opened a window', () => {
    expect(sessionWindow(null, NOW)).toMatchObject({ known: true, open: false, expiresAt: null })
  })

  it('treats a missing or unparseable anchor as UNKNOWN — never guess a clock', () => {
    expect(sessionWindow(undefined, NOW)).toMatchObject({ known: false, open: false })
    expect(sessionWindow('not-a-date', NOW)).toMatchObject({ known: false, open: false })
  })
})

describe('windowLeftParts', () => {
  it('splits the remaining time into whole hours and minutes for interpolation', () => {
    expect(windowLeftParts(5 * 60 * 60 * 1000 + 12 * 60 * 1000)).toEqual({ hours: 5, minutes: 12 })
    expect(windowLeftParts(45 * 60 * 1000)).toEqual({ hours: 0, minutes: 45 })
    expect(windowLeftParts(-1)).toEqual({ hours: 0, minutes: 0 })
  })
})
