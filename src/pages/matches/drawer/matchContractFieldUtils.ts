/**
 * matchContractFieldUtils — pure UI-draft ↔ API-body mapping helpers for the
 * match/contract fields. Shared (§11 — one source, never a copy) by every place
 * that edits this layer: MatchContractSection's own remaining fields AND, since
 * MATCH-EDIT-1, OverviewTab's Contract/Financieel card (the six fields that moved
 * there — contract_type/start_date/end_date/hours_per_week/cost_center/
 * billing_emails — no longer render on the Contract tab, §3A "no field in two places").
 */

// Split the textarea's free text back into a trimmed, de-duplicated email array.
export function parseEmails(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map(s => s.trim()).filter(Boolean))]
}

// Coerce an empty/undefined UI value to null; else Number(...) for the API.
export function numOrNull(v: unknown): number | null {
  return v === '' || v == null ? null : Number(v)
}
