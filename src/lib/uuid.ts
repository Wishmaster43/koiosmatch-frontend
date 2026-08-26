/**
 * isUuid — the one UUID test in this app.
 *
 * It exists because three files had grown their own identical copy: two changelog
 * tabs (which hide raw ids from a human-readable diff) and the add-application modal
 * (which tells a real backend id apart from a seed slug, so it never offers an option
 * the server would 422 on). A regex copied three times drifts on the fourth copy.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Matches the canonical UUID format (see the module doc above for why this one shared check replaces three drifting copies).
export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value)
}
