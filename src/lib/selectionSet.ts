// Selection Set helpers — pure, immutable Set operations for bulk selection toggles.
// Two operations power every checkbox in the app: add/remove one, toggle all.

/**
 * Toggle one id in an immutable Set (a new Set is returned, the input is never mutated).
 */
export function toggleInSet<T>(prev: Set<T>, id: T): Set<T> {
  const next = new Set(prev)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

/**
 * Add every id when none-selected, remove every id when all were selected (the header checkbox).
 */
export function toggleAllInSet<T>(prev: Set<T>, ids: T[], allSelected: boolean): Set<T> {
  const next = new Set(prev)
  ids.forEach(id => {
    if (allSelected) {
      next.delete(id)
    } else {
      next.add(id)
    }
  })
  return next
}
