/**
 * filterValueToken — the ONE place that spells the mapping-token syntax for an
 * edge-filter condition's VALUE (FILTER-MAPPING-1, ADDENDUM 2 CMBE-confirmed):
 * `{{N.field}}`, N the 1-based module number as the panel's own upstream walk
 * numbers it (filterFieldCatalog.ts), field the bare dot-path. The backend's
 * FieldFormatter strips the leading "N." as display sugar (same rule as the
 * existing `kandidaat.` alias) and resolves the bare path against the merged
 * bundle — N carries no server meaning, it only lets the chip read "N. module ·
 * field" like the field picker does. `parseFilterValueToken` also accepts the
 * bare `{{path}}` form (no module prefix) and a trailing `|format` suffix.
 */
export function filterValueToken(number: number, fieldKey: string): string {
  return `{{${number}.${fieldKey}}}`
}

// A value is EXACTLY one mapping token (no surrounding text) when it matches
// this whole-string shape — the only case the backend keeps the raw type for.
const TOKEN = /^\{\{(.+)\}\}$/

export function isFilterValueToken(value: string): boolean {
  return TOKEN.test(value.trim())
}

export interface ParsedFilterValueToken {
  number: number | null
  field: string
  format?: string
}

// Parses a mapping token back into its module number (for the chip label, or
// null when the token carries no "N." prefix), bare field path and optional
// `|format` suffix. Returns null when `value` is not a token at all.
export function parseFilterValueToken(value: string): ParsedFilterValueToken | null {
  const m = TOKEN.exec(value.trim())
  if (!m) return null
  let inner = m[1]
  let format: string | undefined
  const pipeIdx = inner.indexOf('|')
  if (pipeIdx !== -1) { format = inner.slice(pipeIdx + 1); inner = inner.slice(0, pipeIdx) }
  const numMatch = /^(\d+)\.(.+)$/.exec(inner)
  if (numMatch) return { number: Number(numMatch[1]), field: numMatch[2], format }
  return { number: null, field: inner, format }
}
