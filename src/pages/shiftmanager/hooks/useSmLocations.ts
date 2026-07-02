/**
 * useSmLocations — loads the ShiftManager locations mirror (/sm_locations) and
 * maps each raw row to the flat SmLocationRow the page renders. A failed/empty
 * call is an empty list, never fabricated rows (§3). Via React Query: request
 * dedup + caching + auto-cancel on unmount (A-3 — replaces the raw useEffect fetch).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { SmLocationRow } from '@/types/shiftmanager'

interface RawLocation {
  id?: string | number
  name?: string
  customer?: string | { name?: string }
  city?: string
  address?: string
  status?: string
  departments?: Array<string | { name?: string }>
  shift_count?: number
  [k: string]: unknown
}

export function useSmLocations(): { locations: SmLocationRow[] } {
  // Fetch + flatten the raw rows into the shape the table renders (signal = cancel).
  const { data } = useQuery({
    queryKey: ['sm_locations'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<RawLocation>(await api.get('/sm_locations', { signal }))
      return rows.map(l => ({
        id:          l.id,
        name:        l.name ?? '',
        customer:    (typeof l.customer === 'object' ? l.customer?.name : l.customer) ?? '',
        city:        l.city ?? '',
        address:     l.address ?? '',
        status:      l.status === 'active' ? 'Actief' : l.status === 'inactive' ? 'Inactief' : (l.status ?? 'Actief'),
        departments: (l.departments ?? []).map(d => (typeof d === 'object' ? d?.name : d) ?? ''),
        shifts:      l.shift_count ?? 0,
      })) as SmLocationRow[]
    },
  })

  return { locations: data ?? [] }
}
