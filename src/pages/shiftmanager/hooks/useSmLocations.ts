/**
 * useSmLocations — loads the ShiftManager locations mirror (/sm_locations) and
 * maps each raw row to the flat SmLocationRow the page renders. A failed/empty
 * call is an empty list, never fabricated rows (§3). Keeps the fetch + transform
 * out of the component; cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
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
  const [locations, setLocations] = useState<SmLocationRow[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_locations', { signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList<RawLocation>(res)
        setLocations(rows.map(l => ({
          id:          l.id,
          name:        l.name ?? '',
          customer:    (typeof l.customer === 'object' ? l.customer?.name : l.customer) ?? '',
          city:        l.city ?? '',
          address:     l.address ?? '',
          status:      l.status === 'active' ? 'Actief' : l.status === 'inactive' ? 'Inactief' : (l.status ?? 'Actief'),
          departments: (l.departments ?? []).map(d => (typeof d === 'object' ? d?.name : d) ?? ''),
          shifts:      l.shift_count ?? 0,
        })))
      })
      .catch(err => { if (!isAbortError(err)) setLocations([]) })
    return () => ctrl.abort()
  }, [])

  return { locations }
}
