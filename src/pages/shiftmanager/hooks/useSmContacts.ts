/**
 * useSmContacts — loads the Shiftmanager contacts mirror (/sm_contacts) and maps
 * each raw row to the flat SmContactRow the page renders. A failed/empty call is
 * an empty list, never fabricated rows (§3). Via React Query: request dedup +
 * caching + auto-cancel on unmount (A-3 — replaces the raw useEffect fetch).
 */
import { useQuery } from '@tanstack/react-query'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { SM_FETCH_ALL } from './smFetchAll'
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

// A stable empty list: a fresh [] per render re-triggers every consumer memo/effect
// (LocationsPage's registerFilters loop — 'Maximum update depth exceeded', measured 03-09).
const EMPTY: SmContactRow[] = []

export function useSmContacts(): { contacts: SmContactRow[]; truncated: boolean; isLoading: boolean; isError: boolean; refetch: () => void } {
  // Fetch + flatten the raw rows into the shape the table renders (signal = cancel).
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sm_contacts'],
    queryFn: async ({ signal }) => {
      // Full set, not one server page: the pages filter and count client-side (cap 200, bounded at 20 pages).
      const { rows, truncated } = await fetchAllPages<RawContact>('/sm_contacts', {}, signal, SM_FETCH_ALL)
      const mapped = rows.map(c => ({
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
      return { rows: mapped, truncated }
    },
  })

  // The page owns the four UI states (§3): loading/error ride along, never swallowed.
  return { contacts: data?.rows ?? EMPTY, truncated: data?.truncated ?? false, isLoading, isError, refetch }
}
