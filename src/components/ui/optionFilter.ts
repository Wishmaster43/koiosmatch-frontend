/**
 * matchesOptionQuery — shared option-filter predicate for the house dropdown
 * primitives (DUP-06). The three pickers each hand-rolled a near-identical
 * "does this option match the typed query" check that differed in small ways:
 * SelectMenu trimmed the query AND coerced a possibly-non-string `label`
 * (ReactNode) via `String()`; CreatableSelect/SearchSelect's `label` is
 * typed as a plain string, so no coercion was needed there, but SearchSelect
 * never trimmed the query at all. This picks SelectMenu's behaviour — trim +
 * coerce — as the one shared rule: it is the strictest of the three (handles
 * the ReactNode case none of the others has to) and trimming the query is a
 * pure improvement for the untrimmed case (" foo " now matches same as
 * "foo", never fewer matches than before).
 */

// True when `label` (coerced to string) contains `query`, case-insensitive, both trimmed.
export function matchesOptionQuery(label: unknown, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return String(label ?? '').toLowerCase().includes(q)
}
