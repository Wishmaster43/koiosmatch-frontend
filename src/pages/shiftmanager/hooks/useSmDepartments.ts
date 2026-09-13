/**
 * useSmDepartments — loads the Shiftmanager departments mirror (/sm_departments)
 * and maps each raw row to the flat SmDepartmentRow the page renders. A failed/
 * empty call is an empty list, never fabricated rows (§3). Via React Query: request
 * dedup + caching + auto-cancel on unmount (A-3 — replaces the raw useEffect fetch).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { SmDepartmentRow } from '@/types/shiftmanager'

interface RawDepartment {
  id?: string | number
  name?: string
  customer?: string | { name?: string }
  location?: string | { name?: string }
  city?: string
  cost_center?: string
  status?: string
  employee_count?: number
  shift_count?: number
  [k: string]: unknown
}

// A stable empty list: a fresh [] per render re-triggers every consumer memo/effect
// (LocationsPage's registerFilters loop — 'Maximum update depth exceeded', measured 03-09).
const EMPTY: SmDepartmentRow[] = []

export function useSmDepartments(): { departments: SmDepartmentRow[]; isLoading: boolean; isError: boolean; refetch: () => void } {
  // Fetch + flatten the raw rows into the shape the table renders (signal = cancel).
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sm_departments'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<RawDepartment>(await api.get('/sm_departments', { signal }))
      return rows.map(d => ({
        id:         d.id,
        name:       d.name ?? '',
        customer:   (typeof d.customer === 'object' ? d.customer?.name : d.customer) ?? '',
        location:   (typeof d.location === 'object' ? d.location?.name : d.location) ?? '',
        city:       d.city ?? '',
        costCenter: d.cost_center ?? '',
        // Stable English slug — the raw server status, or 'active' as the sane
        // default; render sites translate it (departmentsPage.status.<slug>).
        status:     d.status ?? 'active',
        employees:  d.employee_count ?? 0,
        shifts:     d.shift_count ?? 0,
      })) as SmDepartmentRow[]
    },
  })

  // The page owns the four UI states (§3): loading/error ride along, never swallowed.
  return { departments: data ?? EMPTY, isLoading, isError, refetch }
}
