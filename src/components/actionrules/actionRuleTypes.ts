/**
 * actionRuleTypes — the shape of one AXIS-MATRIX-2 preflight decision, mirroring
 * `ActionRuleDecision::toArray()` (app/Services/ActionRules/ActionRuleGuard.php)
 * verbatim: `GET /action-rules/preflight` and the Koios `pending_action.warning`
 * both speak this shape, so one type serves both call sites (§3A "extend, never
 * duplicate").
 */

// One evaluated action×condition cell. `message` is the server's own, tenant-
// configurable text — rendered verbatim, never re-translated client-side.
export interface ActionRuleDecision {
  effect: 'allow' | 'warn' | 'block'
  popup_code?: string | null
  message?: string | null
  condition?: string | null
  context?: Record<string, unknown> | null
}

// Exactly one of these identifies the preflight subject (candidate XOR customer —
// mirrors ActionRuleController::preflight's `required_without`/`prohibits` pair).
export interface ActionRuleSubject {
  candidateId?: string | null
  customerId?: string | null
}
