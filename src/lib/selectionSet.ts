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

/**
 * makeArrayToggle — the curried right-panel multi-toggle shared by several
 * pages' filter dimensions: takes a setState `set`, returns a toggler for one
 * value that add/removes it via toggleInList. Same shape as each page's own
 * local `tog` helper (OpportunitiesPage/TasksPage/…), pulled here once.
 */
export function makeArrayToggle(set: (fn: (prev: string[]) => string[]) => void) {
  return (v: string) => set(p => toggleInList(p, v))
}

/**
 * makeToggleIn — the shared "toggle one value inside one array-valued settings
 * key, then persist the whole config" factory used by every settings screen
 * with several checkbox-list keys (CandidateVacancyTabSettings /
 * VacancyCandidateTabSettings): `cfg` reads the current per-key arrays, `persist`
 * writes the full patched object back (each caller decides its own base — the
 * live `cfg` or a `stored`-only base, see VacancyCandidateTabSettings' own comment).
 */
export function makeToggleIn<C extends Record<string, string[]>>(
  cfg: C,
  persist: (patch: Partial<C>) => void,
) {
  return (key: keyof C) => (value: string) =>
    persist({ [key]: toggleInList(cfg[key], value) } as Partial<C>)
}
