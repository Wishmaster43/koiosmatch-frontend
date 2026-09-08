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

/**
 * Toggle one value in an immutable array (a new array is returned, the input is never mutated).
 * Used for filter toggles where state is an array instead of a Set.
 */
export function toggleInList(prev: string[], val: string): string[] {
  return prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
}
