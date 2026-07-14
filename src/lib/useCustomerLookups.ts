/**
 * useCustomerLookups — tenant-configurable customer lookups: the customer's own
 * status PLUS the three SUB-STATUS-1 sub-entity statuses (location/department/
 * contact) — all four come back in ONE call to GET /settings/customer-lookups
 * (CustomerLookupController@index), so this hook stays the single source instead
 * of one hook per sub-entity (mirrors useGenders/LookupsContext). Seed fallback
 * while the API is empty/unavailable. Managed in Settings → Customers → Locaties/
 * Afdelingen/Contactpersonen. NOT a hardcoded enum — tenant-configured.
 */
import { useState, useEffect } from 'react'
import api from './api'
import { normalizeOptions } from './lookupUtils'
import type { LookupOption } from '@/types/common'

// Seed defaults — the values shipped for new tenants and the fallback before the
// backend is ready. Colours match the calm light/dark scheme used across lookups.
export const DEFAULT_CUSTOMER_STATUSES: LookupOption[] = [
  { value: 'actief',      label: 'Actief',      color: '#16A34A' },
  { value: 'prospect',    label: 'Prospect',    color: '#1B60A9' },
  { value: 'inactief',    label: 'Inactief',    color: '#D97706' },
  { value: 'geblokkeerd', label: 'Geblokkeerd', color: '#DC2626' },
]

// Seed defaults for the sub-entity statuses (location/department/contact) — a
// simple active/inactive lifecycle until a tenant configures its own.
export const DEFAULT_SUB_STATUSES: LookupOption[] = [
  { value: 'active',   label: 'Actief',   color: '#16A34A' },
  { value: 'inactive', label: 'Inactief', color: '#9CA3AF' },
]

export function useCustomerLookups() {
  const [statuses,           setStatuses]           = useState<LookupOption[]>(DEFAULT_CUSTOMER_STATUSES)
  const [locationStatuses,   setLocationStatuses]   = useState<LookupOption[]>(DEFAULT_SUB_STATUSES)
  const [departmentStatuses, setDepartmentStatuses] = useState<LookupOption[]>(DEFAULT_SUB_STATUSES)
  const [contactStatuses,    setContactStatuses]    = useState<LookupOption[]>(DEFAULT_SUB_STATUSES)
  const [loading,  setLoading]  = useState(true)

  // Load the tenant config once; cookie mode has no JS-visible token so just try.
  useEffect(() => {
    api.get('/settings/customer-lookups')
      .then(res => {
        const d = res.data?.data ?? res.data ?? {}
        setStatuses(normalizeOptions(d.statuses, DEFAULT_CUSTOMER_STATUSES, '#6B7280') ?? DEFAULT_CUSTOMER_STATUSES)
        setLocationStatuses(normalizeOptions(d.location_statuses, DEFAULT_SUB_STATUSES, '#6B7280') ?? DEFAULT_SUB_STATUSES)
        setDepartmentStatuses(normalizeOptions(d.department_statuses, DEFAULT_SUB_STATUSES, '#6B7280') ?? DEFAULT_SUB_STATUSES)
        setContactStatuses(normalizeOptions(d.contact_statuses, DEFAULT_SUB_STATUSES, '#6B7280') ?? DEFAULT_SUB_STATUSES)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // value → item helper with a neutral fallback so the UI never crashes.
  const metaIn = (list: LookupOption[]) => (v?: string | null): LookupOption => list.find(s => s.value === v) ?? { value: v ?? '', label: v || '—', color: '#9CA3AF' }

  return {
    statuses, statusMeta: metaIn(statuses),
    locationStatuses,   locationStatusMeta:   metaIn(locationStatuses),
    departmentStatuses, departmentStatusMeta: metaIn(departmentStatuses),
    contactStatuses,    contactStatusMeta:    metaIn(contactStatuses),
    loading,
  }
}
