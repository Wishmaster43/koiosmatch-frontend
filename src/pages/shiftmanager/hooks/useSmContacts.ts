/**
 * useSmContacts — loads the ShiftManager contacts mirror (/sm_contacts) and maps
 * each raw row to the flat SmContactRow the page renders. A failed/empty call is
 * an empty list, never fabricated rows (§3). Via React Query: request dedup +
 * caching + auto-cancel on unmount (A-3 — replaces the raw useEffect fetch).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { SmContactRow } from '@/types/shiftmanager'

interface RawContact {
  id?: string | number
  first_name?: string; firstname?: string
  last_name?: string; lastname?: string
  function_title?: string
  customer?: string | { name?: string }
  location?: string | { name?: string }
  email?: string; mobile?: string; planning?: unknown
  [k: string]: unknown
}

export function useSmContacts(): { contacts: SmContactRow[] } {
  // Fetch + flatten the raw rows into the shape the table renders (signal = cancel).
  const { data } = useQuery({
    queryKey: ['sm_contacts'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<RawContact>(await api.get('/sm_contacts', { signal }))
      return rows.map(c => ({
        id:             c.id,
        firstname:      c.first_name ?? c.firstname ?? '',
        lastname:       c.last_name ?? c.lastname ?? '',
        function_title: c.function_title ?? '',
        customer:       (typeof c.customer === 'object' ? c.customer?.name : c.customer) ?? '',
        location:       (typeof c.location === 'object' ? c.location?.name : c.location) ?? '',
        email:          c.email ?? '',
        mobile:         c.mobile ?? '',
        planning:       !!c.planning,
      })) as SmContactRow[]
    },
  })

  return { contacts: data ?? [] }
}
