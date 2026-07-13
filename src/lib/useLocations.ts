/**
 * useLocations — the tenant's own establishments/branches (GET /locations), used
 * wherever a picker needs a real physical location (e.g. the appointment "where"
 * field). Defensive id+name mapping; empty list on failure, never fabricated rows
 * (§3). Distinct from a customer's nested locations (features/customers).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface LocationOption { value: Id; label: string }

export function useLocations(): LocationOption[] {
  const { data } = useQuery({
    queryKey: ['locations', 'options'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ id?: Id; name?: string }>(await api.get('/locations', { signal }))
      return rows.map(l => ({ value: l.id ?? '', label: l.name ?? '' })) as LocationOption[]
    },
  })
  return data ?? []
}
