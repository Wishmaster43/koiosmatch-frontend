/**
 * Shared shape for a customer sub-entity delete call (location/department,
 * SUBENTITEIT-DELETE-1). Three outcomes: deleted; a generic failure (already
 * toasted by the hook itself); or a 409 "still in use" RACE — the row's own
 * `in_use` flag was stale (something got linked after the list last loaded) —
 * carrying the server's per-relation counts so the caller can show the ONE
 * shared counts dialog instead of a blanket toast.
 */
export interface DeleteResult {
  ok: boolean
  blocked?: { message?: string; counts: Record<string, number> }
}
