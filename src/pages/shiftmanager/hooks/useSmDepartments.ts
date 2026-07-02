/**
 * useSmDepartments — loads the ShiftManager departments mirror (/sm_departments)
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

export function useSmDepartments(): { departments: SmDepartmentRow[] } {
  // Fetch + flatten the raw rows into the shape the table renders (signal = cancel).
  const { data } = useQuery({
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
        status:     d.status === 'active' ? 'Actief' : d.status === 'inactive' ? 'Inactief' : (d.status ?? 'Actief'),
        employees:  d.employee_count ?? 0,
        shifts:     d.shift_count ?? 0,
      })) as SmDepartmentRow[]
    },
  })

  return { departments: data ?? [] }
}
