/**
 * runReason — the run-level `reason` (RUN-SKIPPED-REASON-FE-1 / N-006) is a
 * stable CODE from the backend's fixed vocabulary; the user reads a translated
 * sentence, never the raw code. A pure helper in its own module, mirroring
 * blockedReason.ts's precedent next to the table.
 */
import type { TFunction } from 'i18next'

// INTERVIEW-KICKOFF-VACANCY-1 (CMBE during-onix c76b27d2): the fixed set of
// skip + selection reason codes WorkflowRun::INTERVIEW_SKIP_REASONS ∪
// INTERVIEW_SELECTION_REASONS can carry. Kept as a const list so an unknown
// code (older run, future BE addition) is detectable and falls back honestly.
export const RUN_REASON_CODES = [
  'interview_workflow_inactive',
  'interview_workflow_not_selected',
  'interview_workflow_conditions_not_met',
  'already_running',
  'no_candidate',
  'no_active_flow',
  'rejected_stage',
  'placed_stage',
  'no_mobile_or_consent',
  'wa_web_send_not_supported',
  'no_active_connection',
  'already_has_session',
  'send_failed',
  'ai_tier_blocked',
  'no_application_id',
  'application_not_found',
  'application_override',
  'vacancy_coupling',
  'bureau_default',
] as const

export type RunReasonCode = (typeof RUN_REASON_CODES)[number]

// Translate a run-level reason code to the tenant's active language. A known
// code resolves through i18n; an unknown code (future BE addition, legacy
// free-text run) renders verbatim rather than a blank or a raw i18n key; a
// missing reason is null, never a placeholder string.
export function runReasonLabel(
  code: string | null | undefined,
  t: TFunction
): string | null {
  if (!code) return null
  if ((RUN_REASON_CODES as readonly string[]).includes(code)) {
    return t(`runs.reasons.${code}`)
  }
  return code
}
