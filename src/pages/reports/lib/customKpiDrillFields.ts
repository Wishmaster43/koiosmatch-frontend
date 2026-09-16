/**
 * customKpiDrillFields — which raw row fields the shared drill drawer shows for a
 * tenant-defined KPI's drill (KPI-BUILDER-FE-1 §3.7), per entity. Pure lookup +
 * picker so ReportDrillDrawer (batch E) needs no per-entity switch of its own.
 * Date-shaped values (`*_date`/`*_at`) are formatted DD-MM-YYYY by the CALLER
 * (DATUM-1) — this file only selects which fields to show, never how to render them.
 */

// One row-field list per custom-KPI entity (CustomKpiCard['entity']). Kept as a
// plain record (not a switch) so a missing entity falls back to `undefined` —
// the caller then keeps its own default field list, byte-identical to today.
export const CUSTOM_KPI_DRILL_FIELDS: Partial<Record<string, string[]>> = {
  match: ['client', 'status', 'end_date'],
  candidate: ['status', 'function_title', 'city'],
  application: ['stage', 'client'],
  task: ['status', 'assignee'],
  vacancy: ['client', 'status'],
  opportunity: ['customer', 'status'],
  outreach: ['status', 'assignee'],
  whatsapp: ['wa_number'],
  customer: ['status', 'city'],
}

// Picks the requested fields off a drill row, in order, skipping any that are
// absent/null/undefined so a partial row never renders empty placeholders.
export function pickDrillFields(row: Record<string, unknown>, fields: string[]): unknown[] {
  return fields
    .map((field) => row[field])
    .filter((value) => value != null)
}
