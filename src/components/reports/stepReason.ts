/**
 * stepReason — the step-level `reason` (STEP-OUTCOMES-1; on the live `steps[]` rows of the run
 * endpoints since BE lane O 1e5c986b5) is a stable CODE from the backend's skip vocabulary
 * (lang/{en,nl}/workflow.php `skip_reasons`); the user reads a translated sentence, never the raw
 * code and never the server's own sentence when the code is known. Mirrors runReason.ts (the
 * run-level vocabulary) as a pure helper next to the step list.
 */
import type { TFunction } from 'i18next'

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
] as const

export type StepReasonCode = (typeof STEP_REASON_CODES)[number]

// Translate a step's reason code in the active language (`t` of the reports namespace); null for a
// missing or unknown code, so the caller keeps its own fallback (the server sentence), never a raw code.
export function stepReasonLabel(code: string | null | undefined, t: TFunction): string | null {
  if (!code) return null
  return (STEP_REASON_CODES as readonly string[]).includes(code) ? t(`runs.stepReasons.${code}`) : null
}
