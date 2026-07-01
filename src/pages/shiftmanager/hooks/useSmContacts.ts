/**
 * useSmContacts — loads the ShiftManager contacts mirror (/sm_contacts) and maps
 * each raw row to the flat SmContactRow the page renders. A failed/empty call is
 * an empty list, never fabricated rows (§3). Keeps the fetch + transform out of
 * the component; cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
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
  const [contacts, setContacts] = useState<SmContactRow[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_contacts', { signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList<RawContact>(res)
        setContacts(rows.map(c => ({
          id:             c.id,
          firstname:      c.first_name ?? c.firstname ?? '',
          lastname:       c.last_name ?? c.lastname ?? '',
          function_title: c.function_title ?? '',
          customer:       (typeof c.customer === 'object' ? c.customer?.name : c.customer) ?? '',
          location:       (typeof c.location === 'object' ? c.location?.name : c.location) ?? '',
          email:          c.email ?? '',
          mobile:         c.mobile ?? '',
          planning:       !!c.planning,
        })))
      })
      .catch(err => { if (!isAbortError(err)) setContacts([]) })
    return () => ctrl.abort()
  }, [])

  return { contacts }
}
