/**
 * useAssignableBranches — the branches a signed-in user may ASSIGN a record to
 * (Task/Opportunity/JobMatch/Vacancy `location_id`), narrowed to `auth/me.branch_ids`
 * exactly like `useBranchOptions` narrows its FILTER list — but without that hook's
 * "Zonder vestiging" sentinel, which is a server filter token, never an assignable
 * branch (ONIX D-003: a branch-restricted user must not be offered a branch they hold
 * no grant on — writing one the user has no grant on now answers 403, so the picker
 * narrowing is UX, the server guard is the real enforcement).
 *
 * An EMPTY `branch_ids` means unrestricted (every establishment), same rule as
 * useBranchOptions — getting it backwards would hand an unrestricted admin an empty
 * picker. The narrowing itself is the one shared `narrowToGrants` helper below, so
 * there is a single implementation of "which branches does this user hold" for both
 * the filter hook and this assignment hook (§11 — a new helper lands with its adopter,
 * never a second copy of the same narrowing logic).
 */
import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLocations } from '@/lib/useLocations'
import type { LocationOption } from '@/lib/useLocations'

export type { LocationOption }

// Pure narrowing: an empty `branchIds` means unrestricted (every location passes
// through unchanged); a non-empty list keeps only the locations the user holds,
// compared as strings since the backend serialises ids as numbers in some payloads.
// Generic over the option shape (callers hold either the raw `LocationOption` or an
// already-stringified `{ value: string; label: string }`) so this one implementation
// serves both useBranchOptions' and useAssignableBranches' own value types.
export function narrowToGrants<T extends { value: string | number }>(locations: T[], branchIds: Array<string | number> | undefined): T[] {
  const ids = (branchIds ?? []).map(String)
  if (!ids.length) return locations
  return locations.filter(l => ids.includes(String(l.value)))
}

// A record's current value may sit on a branch outside the user's own grants (a
// vacancy on a foreign branch, a task someone else placed) — that value stays
// VISIBLE (read-only presence) rather than silently disappearing from the field.
// Appends the current option only when the narrowed list doesn't already carry it.
export function withCurrentOption<T extends { value: string | number; label: string }>(options: T[], current: T | null | undefined): T[] {
  if (!current || current.value == null || current.value === '') return options
  if (options.some(o => String(o.value) === String(current.value))) return options
  return [...options, current]
}

// Assignment-only branch options for the four D-003 pickers: every tenant establishment
// narrowed to the user's own scope, memoised like useBranchOptions.
export function useAssignableBranches(): LocationOption[] {
  const auth = useAuth()
  // Read defensively: shared auth payload, the field is optional for other consumers.
  const me = auth?.user as { branch_ids?: Array<string | number> } | null | undefined
  const locations = useLocations()

  return useMemo(() => narrowToGrants(locations, me?.branch_ids), [locations, me?.branch_ids])
}
