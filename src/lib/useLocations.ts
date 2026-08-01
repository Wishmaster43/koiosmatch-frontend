/**
 * useLocations — the tenant's own establishments/branches (GET /locations), used
 * wherever a picker needs a real physical location (e.g. the appointment "where"
 * field). Defensive id+name mapping; empty list on failure, never fabricated rows
 * (§3). Distinct from a customer's nested locations (features/customers).
 *
 * `is_default` (mirrors useAppointmentLocations' same-named flag) is read
 * defensively — it is a tenant-default candidate for the Match "Vestiging"
 * proposal (7.4); if the backend row doesn't carry it, it stays `false` and the
 * proposal simply falls through to the next default source (no crash, honest).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface LocationOption { value: Id; label: string; is_default?: boolean }

// Stable empty result — see the return below for why the identity matters.
const EMPTY: LocationOption[] = []

export function useLocations(): LocationOption[] {
  const { data } = useQuery({
    queryKey: ['locations', 'options'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ id?: Id; name?: string; is_default?: boolean }>(await api.get('/locations', { signal }))
      return rows.map(l => ({ value: l.id ?? '', label: l.name ?? '', is_default: Boolean(l.is_default) })) as LocationOption[]
    },
  })
  // ONE frozen empty array, not a fresh `[]` per render. While the query is still
  // loading (or failed), `data ?? []` handed every caller a new identity each render —
  // and a caller that memoises on it then rebuilds whatever it derives, forever. That
  // is what looped the applications page: unstable options -> unstable filter groups ->
  // the register/unregister effect firing on every render (01-08).
  return data ?? EMPTY
}
