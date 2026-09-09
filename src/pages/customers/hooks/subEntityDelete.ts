import type { Id } from '@/types/common'

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

// The reusable delete handler: resolves the async onDelete, checks its result,
// and routes to the appropriate outcome (close on success, show counts dialog on 409 race).
export function handleSubEntityDelete(
  onDelete: (id: Id) => void | Promise<DeleteResult>,
  entityId: Id,
  close: () => void,
  setBlockedCounts: (counts: Record<string, number> | null) => void
) {
  Promise.resolve(onDelete(entityId)).then(result => {
    if (!result) { close(); return } // legacy void return (older callers/tests)
    if (result.ok) { close(); return }
    if (result.blocked) setBlockedCounts(result.blocked.counts)
  })
}
