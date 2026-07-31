/**
 * useBranchOptions — the branch (vestiging) values a signed-in user may filter on,
 * ready as `{ value, label }` picker options.
 *
 * It is the tenant's establishments (`useLocations`) narrowed to the user's OWN scope
 * from `auth/me.branch_ids`. That narrowing is the whole point: a branch filter is a
 * NARROWING within what someone may already see, never a widening, so offering a branch
 * they have no rights to would only ever produce an empty list (VESTIGING-2, backend
 * contract 28-07 — asking for a branch outside your scope returns nothing, not a 403).
 *
 * An EMPTY `branch_ids` means unrestricted, not "no branches": such a user gets every
 * establishment. Getting that backwards would hand an unrestricted admin an empty filter.
 *
 * Extracted 31-07 after this exact block landed verbatim in four list pages in one
 * change — a shared helper has to arrive with its adopters, or it is just a fifth copy
 * (§11).
 */
import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLocations } from '@/lib/useLocations'

export interface BranchOption { value: string; label: string }

export function useBranchOptions(): BranchOption[] {
  const auth = useAuth()
  // Read defensively: the auth payload is shared with several other consumers and this
  // field is optional there, so it is cast at the edge rather than assumed.
  const me = auth?.user as { branch_ids?: Array<string | number> } | null | undefined
  const locations = useLocations()

  return useMemo(() => {
    const ids = (me?.branch_ids ?? []).map(String)
    const all = locations.map(l => ({ value: String(l.value), label: l.label }))
    return ids.length ? all.filter(o => ids.includes(o.value)) : all
  }, [locations, me?.branch_ids])
}
