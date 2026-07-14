/**
 * mentionScope — pure helper for the composer's two-step "@" flow (KOIOS-
 * SEARCH-1): pick a category (inserts "@<Label> ") → keep typing to search
 * WITHIN that category. `matchMentionQuery` only ever returns the raw tail
 * after the last "@"; this decides whether that tail still starts with the
 * chosen category's label (still scoped — return the remaining query) or the
 * user edited past it (backspaced the label, started a fresh mention — exit
 * scope, `null`). No React/DOM here so the prefix logic is unit-testable
 * in isolation, same style as mentionMatch.ts.
 */
export function resolveScopedQuery(tail: string, activeLabel: string | null): string | null {
  if (!activeLabel) return null
  const label = activeLabel.toLowerCase()
  const t = tail.toLowerCase()
  if (t === label) return '' // label typed, no query yet (space not typed/kept)
  if (t.startsWith(label + ' ')) return tail.slice(activeLabel.length + 1)
  return null // the prefix no longer matches — the user left this category's scope
}
