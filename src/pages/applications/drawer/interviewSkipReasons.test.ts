// interviewSkipReasons — the shared skip vocabulary narrows only the contract's stable codes (SHARED-UNIT-TEST-1).
import { describe, it, expect } from 'vitest'
import { INTERVIEW_SKIP_CODES, isInterviewSkipCode } from './interviewSkipReasons'

describe('isInterviewSkipCode', () => {
  it('accepts every code of the contract vocabulary, including the K-006/I-001 gates', () => {
    for (const code of INTERVIEW_SKIP_CODES) expect(isInterviewSkipCode(code)).toBe(true)
    expect(INTERVIEW_SKIP_CODES).toEqual(expect.arrayContaining(['no_interview_consent', 'ai_disclosure_missing', 'action_rule_blocked']))
  })

  it('rejects an unknown or future code, so the caller reads it generically', () => {
    expect(isInterviewSkipCode('some_future_reason')).toBe(false)
    expect(isInterviewSkipCode('')).toBe(false)
  })

  it('rejects non-string values (a missing reason on the response)', () => {
    expect(isInterviewSkipCode(undefined)).toBe(false)
    expect(isInterviewSkipCode(null)).toBe(false)
    expect(isInterviewSkipCode(42)).toBe(false)
  })
})

// CONTRACT-FOLLOW-1 A1: the two new codes of c36143c0c.
describe('CONTRACT-FOLLOW-1 skip codes', () => {
  it('accepts already_has_session and interview_flow_inactive', () => {
    expect(isInterviewSkipCode('already_has_session')).toBe(true)
    expect(isInterviewSkipCode('interview_flow_inactive')).toBe(true)
  })
})
