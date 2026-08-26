/**
 * Reference-number query detector (NUMMER-1) — a typed prefix + at least 2 digits
 * (K-00123, D-4, V-12, L-001, A-001, M-00042) means the page's header search should
 * do an exact server-side `?ref=` lookup instead of the normal free-text `?search=`.
 * Case-insensitive on the backend, so no case normalisation needed here.
 */
const REFERENCE_QUERY_RE = /^[A-Za-z]{1,3}-\d{2,}$/

// True when the typed query looks like a reference number (prefix + at least 2 digits), so the header search does an exact ?ref= lookup instead of a free-text search.
export function isReferenceQuery(query: string): boolean {
  return REFERENCE_QUERY_RE.test(query.trim())
}
