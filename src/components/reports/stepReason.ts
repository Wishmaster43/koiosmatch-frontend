/**
 * stepReason — the step-level `reason` (STEP-OUTCOMES-1; on the live `steps[]` rows of the run
 * endpoints since BE lane O 1e5c986b5) is a stable CODE from the backend's skip vocabulary
 * (lang/{en,nl}/workflow.php `skip_reasons`); the user reads a translated sentence, never the raw
 * code and never the server's own sentence when the code is known. `stepBlockedCodes` also reads the
 * refusal popup codes (P3, P5) off the trailing suffix of a blocked step's message or error. Mirrors runReason.ts (the
 * run-level vocabulary) as a pure helper next to the step list.
 */
import type { TFunction } from 'i18next'
import type { RunStep } from '@/types/reports'

// The fixed set of step skip/outcome codes the engine writes to `output.skip_reason`. Kept as a const
// list so an unknown code (an older run, a future BE addition) is detectable and the caller falls back
// to the server's own sentence instead of showing a raw code.
export const STEP_REASON_CODES = [
  'no_recipients',
  'consent_missing',
  'action_rule_blocked',
  'nothing_created',
  'sm_opt_out',
  'no_phone',
  'no_email',
  'unsubscribed',
  'retention_link_unsupported',
  'no_device',
  'device_not_connected',
  'no_template',
  'cap_reached',
  'two_way_off',
  'applications_all_blocked',
  'applications_nothing_updated',
  'applications_nothing_created',
  'no_effect',
  'calllist_archived_twin',
  'calllist_nothing_new',
  // BE E1 (WAVE2-HIGH-PRIVACY-SCOPE-1, e7a5e827b): planning steps skip when the candidate or shift is outside the
  // run's branch scope, or when no shift matched.
  'candidate_not_visible',
  'shift_not_visible',
  'planning_no_shift_matched',
] as const

export type StepReasonCode = (typeof STEP_REASON_CODES)[number]

// Translate a step's reason code in the active language (`t` of the reports namespace); null for a
// missing or unknown code, so the caller keeps its own fallback (the server sentence), never a raw code.
export function stepReasonLabel(code: string | null | undefined, t: TFunction): string | null {
  if (!code) return null
  return (STEP_REASON_CODES as readonly string[]).includes(code) ? t(`runs.stepReasons.${code}`) : null
}

// Interim until the BE sends structured codes: the refusal popup codes ride as a trailing "(P3, P5)" on the step text.
const BLOCKED_REASONS = ['action_rule_blocked', 'applications_all_blocked']
const CODE_SUFFIX = /\(([A-Z]\d+(?:\s*,\s*[A-Z]\d+)*)\)\s*$/
export function stepBlockedCodes(step: Pick<RunStep, 'reason' | 'message' | 'error' | 'error_message'>): string[] {
  if (!step.reason || !BLOCKED_REASONS.includes(step.reason)) return []
  for (const text of [step.message, step.error, step.error_message]) {
    const hit = text ? CODE_SUFFIX.exec(text) : null
    if (hit) return hit[1].split(',').map(c => c.trim())
  }
  return []
}
