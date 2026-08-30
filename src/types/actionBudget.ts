/**
 * ActionBudget — the staffel-stand payload PRIJSMODEL-C (K-227) attaches to a
 * declined/budget_exceeded action result. ONE shape shared by the four surfaces
 * that can hit a full staffel: Koios pending actions (confirm), the note
 * popup's action items, the rich-text assist panel, and a workflow run —
 * instead of four hand-rolled copies. Hand-written: no 2xx schema for these
 * routes yet (CLAUDE.md §10). Prices are deliberately absent (no staffel PRICES
 * on koios.use surfaces, least privilege) — only usage/allowance/state.
 */
export type ActionBudgetState = 'ok' | 'warn' | 'blocked'

export interface ActionBudgetUpgradeHint {
  next_tier_key?: string
  next_tier_label?: string
  // Workflow-run upgrade hints carry a contact/url instead (WorkflowEditorHeader
  // renders a real Button href only when one of these is present).
  contact?: string | null
  url?: string | null
}

export interface ActionBudget {
  state?: ActionBudgetState
  allowance?: number
  used?: number
  remaining?: number
  unit?: string
  upgrade_hint?: ActionBudgetUpgradeHint | null
}
