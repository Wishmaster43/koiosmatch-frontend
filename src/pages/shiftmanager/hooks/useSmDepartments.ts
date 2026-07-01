/**
 * useSmDepartments — loads the ShiftManager departments mirror (/sm_departments)
 * and maps each raw row to the flat SmDepartmentRow the page renders. A failed/
 * empty call is an empty list, never fabricated rows (§3). Keeps the fetch +
 * transform out of the component; cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
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
  const [departments, setDepartments] = useState<SmDepartmentRow[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_departments', { signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList<RawDepartment>(res)
        setDepartments(rows.map(d => ({
          id:         d.id,
          name:       d.name ?? '',
          customer:   (typeof d.customer === 'object' ? d.customer?.name : d.customer) ?? '',
          location:   (typeof d.location === 'object' ? d.location?.name : d.location) ?? '',
          city:       d.city ?? '',
          costCenter: d.cost_center ?? '',
          status:     d.status === 'active' ? 'Actief' : d.status === 'inactive' ? 'Inactief' : (d.status ?? 'Actief'),
          employees:  d.employee_count ?? 0,
          shifts:     d.shift_count ?? 0,
        })))
      })
      .catch(err => { if (!isAbortError(err)) setDepartments([]) })
    return () => ctrl.abort()
  }, [])

  return { departments }
}
