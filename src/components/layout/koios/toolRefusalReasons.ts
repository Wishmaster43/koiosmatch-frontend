// Refusal slugs the Koios pending-action card translates via koios.pendingAction.reasons.<slug>.
// The first 20 mirror the constants of koiosmatch-api app/KoiosAi/ToolRefusalReason.php by hand
// (the OpenAPI spec does not carry that enum), plus slugs other backend sources emit verbatim.
export const TOOL_REFUSAL_REASON_SLUGS: readonly string[] = [
  'agent_not_found',
  'application_not_found',
  'contact_not_found',
  'contact_required',
  'customer_blocked',
  'interview_could_not_start',
  'invalid_rejection_reason',
  'match_not_awaiting_approval',
  'match_not_found',
  'no_running_interview',
  'note_text_required',
  'opportunity_not_found',
  'proposal_cv_required',
  'proposal_in_flight',
  'proposal_not_allowed',
  'proposal_recently_sent',
  'rejection_reason_required',
  'task_not_found',
  'tool_refused',
  'unknown_note_type',
  // Interview engine start reason
  'no_email_consent',
  // Interview engine start reason
  'no_mobile_or_consent',
  // Connection check
  'no_active_connection',
  // ProposalMailer ERROR_* constant
  'send_failed',
  // Appointment lookup that matched nothing (next BE batch)
  'unknown_appointment_lookup',
]
