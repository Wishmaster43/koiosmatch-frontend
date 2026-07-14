/**
 * mentionMatch — pure parser for the composer's "@" mention trigger. Finds the
 * text after the last "@" in the current textarea value and decides whether it
 * still looks like an active mention query (so the picker/search stays open) or
 * the user has moved past it (a newline, punctuation, or a runaway length —
 * close the menu). No React/DOM here so the space-handling fix is unit-testable
 * on its own (the old `/^\w*$/` stopped at the first space — "@ahmed vos" never
 * reached the second word).
 *
 * Unicode-safe: a query may contain letters from any script, digits and spaces,
 * capped at 40 chars so a huge paste can't turn into an unbounded scan/search.
 */
const MAX_QUERY_LENGTH = 40
const ALLOWED_QUERY_RE = /^[\p{L}\p{N} ]*$/u

// Returns the mention query (possibly '' right after typing "@"), or null when
// there is no active mention (no "@", or the tail no longer looks like one).
export function matchMentionQuery(value: string): string | null {
  const lastAt = value.lastIndexOf('@')
  if (lastAt === -1) return null
  const tail = value.slice(lastAt + 1)
  if (tail.length > MAX_QUERY_LENGTH) return null
  if (!ALLOWED_QUERY_RE.test(tail)) return null
  return tail
}
