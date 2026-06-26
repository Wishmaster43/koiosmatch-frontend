/**
 * useCustomerLookups — tenant-configurable customer lookups (statuses for now).
 *
 * Mirrors useGenders/LookupsContext: fed by the API
 * (GET /settings/customer-lookups → { statuses: Item[] }) with a seed default as
 * fallback while the API is empty/unavailable. Managed in Settings → Customers →
 * Statuses. NOT a hardcoded enum — each tenant configures values/labels/colours.
 */
import { useState, useEffect } from 'react'
import api from './api'
import { COOKIE_AUTH } from './authMode'
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

export function useCustomerLookups() {
  const [statuses, setStatuses] = useState<LookupOption[]>(DEFAULT_CUSTOMER_STATUSES)
  const [loading,  setLoading]  = useState(true)

  // Load the tenant config once; cookie mode has no JS-visible token so just try.
  useEffect(() => {
    if (!COOKIE_AUTH && !localStorage.getItem('auth_token')) { setLoading(false); return }
    api.get('/settings/customer-lookups')
      .then(res => { const d = res.data?.data ?? res.data ?? {}; setStatuses(normalizeOptions(d.statuses, DEFAULT_CUSTOMER_STATUSES, '#6B7280') ?? DEFAULT_CUSTOMER_STATUSES) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // value → item helper with a neutral fallback so the UI never crashes.
  const statusMeta = (v?: string | null): LookupOption => statuses.find(s => s.value === v) ?? { value: v ?? '', label: v || '—', color: '#9CA3AF' }

  return { statuses, statusMeta, loading }
}
