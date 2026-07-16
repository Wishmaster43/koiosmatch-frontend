/**
 * ActionRules settings types — the tenant-editable action×condition matrix
 * (AXIS-MATRIX-2, koiosmatch-api/docs/AXIS-MATRIX.md). Mirrors
 * `ActionRuleController::index()`'s row shape (`GET /action-rules`) verbatim.
 */

// One effective matrix cell's effect — allow (silent) · warn (confirm-popup) · block (hard-stop).
export type Effect = 'allow' | 'warn' | 'block'

// One row exactly as `GET /action-rules` / `PUT /settings/action-rules` returns/accepts it.
export interface ActionRuleMatrixRow {
  action: string
  condition: string
  effect: Effect
  popup_code: string | null
}

// The two axes the catalog splits the matrix into (§B candidate axis, §C customer axis).
export type Axis = 'candidate' | 'customer'

// Composite key ("action|condition") — matches ActionRuleController::index()'s own keyBy.
export const cellKey = (action: string, condition: string): string => `${action}|${condition}`
