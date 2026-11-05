/** InterviewStatusCard · pure helpers (duration and status humanizing) (split from InterviewStatusCard.test.tsx; pure helpers only, so no mocks). */
import { describe, it, expect } from 'vitest'
import { resolveDurationSeconds, splitDuration } from '../data/interviewDuration'
import { fullInterview, bareInterview } from './InterviewStatusCard.testKit'
import { humanizeInterviewStatus } from '@/lib/interviewStatus'

describe('resolveDurationSeconds (pure)', () => {
  it('prefers the explicit durationSeconds field over derived timing', () => {
    expect(resolveDurationSeconds(fullInterview({ durationSeconds: 42 }))).toBe(42)
  })

  it('derives seconds from startedAt → lastMessageAt when durationSeconds is absent', () => {
    // 09:00:00 → 09:07:00 = 420 seconds.
    expect(resolveDurationSeconds(fullInterview())).toBe(420)
  })

  it('prefers endedAt over lastMessageAt as the stop point', () => {
    const iv = fullInterview({ endedAt: '2026-07-21T09:10:00Z' })
    expect(resolveDurationSeconds(iv)).toBe(600)
  })

  it('returns null when no timing signal is present at all', () => {
    expect(resolveDurationSeconds(bareInterview)).toBeNull()
  })

  it('returns null on an unparseable timestamp rather than crashing or guessing', () => {
    expect(resolveDurationSeconds(fullInterview({ startedAt: 'not-a-date' }))).toBeNull()
  })
})

describe('splitDuration (pure)', () => {
  it('splits into hours + minutes for a span over an hour', () => {
    expect(splitDuration(3720)).toEqual({ days: 0, hours: 1, minutes: 2 })
  })

  it('reports zero hours and days for a span under an hour', () => {
    expect(splitDuration(420)).toEqual({ days: 0, hours: 0, minutes: 7 })
  })

  // The value is wall clock since the session started, so a WhatsApp thread answered
  // after a weekend really is days — 98 hours must not render as "98u".
  it('carries hours over into days, keeping hours as the remainder within the day', () => {
    expect(splitDuration(4 * 86400 + 2 * 3600 + 300)).toEqual({ days: 4, hours: 2, minutes: 5 })
  })

  it('keeps a span just under a day in hours', () => {
    expect(splitDuration(23 * 3600 + 3540)).toEqual({ days: 0, hours: 23, minutes: 59 })
  })
})

describe('humanizeInterviewStatus (pure)', () => {
  // interview_flows.statuses[] is a TENANT/FLOW-authored vocabulary (verified live
  // against S-00001/Zorgintake) — an unknown value must humanise, never crash or
  // echo the raw SCREAMING_SNAKE enum.
  it('turns a SCREAMING_SNAKE status into a humanised label', () => {
    expect(humanizeInterviewStatus('ACTIVE_IN_CARE')).toBe('Active in care')
  })

  it('collapses repeated underscores and trims stray ones', () => {
    expect(humanizeInterviewStatus('DIPLOMA__CHECK_')).toBe('Diploma check')
  })

  it('leaves a single-word value correctly cased', () => {
    expect(humanizeInterviewStatus('COMPLETED')).toBe('Completed')
  })
})
