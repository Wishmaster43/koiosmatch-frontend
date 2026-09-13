/**
 * matchesLifecycleView — the shared three-way lifecycle predicate (TRASH-OVERAL-2,
 * mirrors candidates): trash view shows only `pending_erase` rows, archived view
 * shows only `archived` rows (so a pending-erase row never double-shows there),
 * default view shows only active (non-archived) rows. Hand-copied identically
 * across matches/opportunities before this consolidation.
 */
interface LifecycleRow {
  lifecycle?: string | null
  archived?: boolean
}

export function matchesLifecycleView(row: LifecycleRow, showTrash: boolean, showArchived: boolean): boolean {
  if (showTrash) return row.lifecycle === 'pending_erase'
  if (showArchived) return row.lifecycle === 'archived'
  return !row.archived
}
