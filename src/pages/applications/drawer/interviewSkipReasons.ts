// The stable interview skip-reason vocabulary of the contract (INTERVIEW-SKIP-ON-APPLICATION-1, extended by the
// ONIX K-006/I-001 gates): one list for the status card's "not started" line and the start action's 422 toast, so a
// new code is added once and both surfaces read the same translated sentence.
export const INTERVIEW_SKIP_CODES = [
  'rejected_stage', 'placed_stage', 'no_mobile_or_consent', 'action_rule_blocked', 'no_interview_consent',
  'wa_web_send_not_supported', 'no_active_connection', 'send_failed', 'ai_disclosure_missing', 'candidate_in_other_interview',
] as const

export type InterviewSkipCode = (typeof INTERVIEW_SKIP_CODES)[number]

// Narrows a server code to the known vocabulary; an unknown or future code reads generically at the call site.
export const isInterviewSkipCode = (v: unknown): v is InterviewSkipCode =>
  typeof v === 'string' && (INTERVIEW_SKIP_CODES as readonly string[]).includes(v)
