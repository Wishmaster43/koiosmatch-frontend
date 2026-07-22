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

export function useLocations(): LocationOption[] {
  const { data } = useQuery({
    queryKey: ['locations', 'options'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ id?: Id; name?: string; is_default?: boolean }>(await api.get('/locations', { signal }))
      return rows.map(l => ({ value: l.id ?? '', label: l.name ?? '', is_default: Boolean(l.is_default) })) as LocationOption[]
    },
  })
  return data ?? []
}
