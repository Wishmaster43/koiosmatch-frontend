/**
 * actionRulesApi — the one call site for `GET /action-rules/preflight` (AXIS-MATRIX-2).
 * Read-open to any tenant user (no permission gate server-side — see
 * routes/api/tenant/action-rules.php), so this never needs a permission check of
 * its own; the write path it guards enforces its own gate independently.
 */
import api from '@/lib/api'
import type { ActionRuleDecision, ActionRuleSubject } from './actionRuleTypes'

// Exactly one of candidateId/customerId is sent — the param name the backend
// validates against (`candidate_id` xor `customer_id`).
export function fetchActionRulePreflight(
  action: string,
  subject: ActionRuleSubject,
  signal?: AbortSignal,
): Promise<ActionRuleDecision> {
  const params: Record<string, string> = { action }
  if (subject.candidateId) params.candidate_id = subject.candidateId
  else if (subject.customerId) params.customer_id = subject.customerId
  return api.get('/action-rules/preflight', { params, signal }).then((r) => r.data)
}
