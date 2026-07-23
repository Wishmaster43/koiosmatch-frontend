/**
 * useCustomerLookups — tenant-configurable customer lookups: the customer's own
 * status PLUS the three SUB-STATUS-1 sub-entity statuses (location/department/
 * contact) — all four come back in ONE call to GET /settings/customer-lookups
 * (CustomerLookupController@index), so this hook stays the single source instead
 * of one hook per sub-entity (mirrors useGenders/LookupsContext). Seed fallback
 * while the API is empty/unavailable. Managed in Settings → Customers → Locaties/
 * Afdelingen/Contactpersonen. NOT a hardcoded enum — tenant-configured.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { normalizeOptions } from './lookupUtils'
import type { LookupOption } from '@/types/common'
import { unwrap } from '@/lib/api'

// Seed defaults — the values shipped for new tenants and the fallback before the
// backend is ready. Colours match the calm light/dark scheme used across lookups.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_CUSTOMER_STATUSES: LookupOption[] = [
  { value: 'actief',      label: 'Actief',      color: '#16A34A' },
  { value: 'prospect',    label: 'Prospect',    color: '#1B60A9' },
  { value: 'inactief',    label: 'Inactief',    color: '#D97706' },
  { value: 'geblokkeerd', label: 'Geblokkeerd', color: '#DC2626' },
]
/* eslint-enable no-restricted-syntax */

// Seed defaults for the sub-entity statuses (location/department/contact) — a
// simple active/inactive lifecycle until a tenant configures its own.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_SUB_STATUSES: LookupOption[] = [
  { value: 'active',   label: 'Actief',   color: '#16A34A' },
  { value: 'inactive', label: 'Inactief', color: '#9CA3AF' },
]
/* eslint-enable no-restricted-syntax */

interface CustomerLookupsData {
  statuses: LookupOption[]
  locationStatuses: LookupOption[]
  departmentStatuses: LookupOption[]
  contactStatuses: LookupOption[]
}

const FALLBACK: CustomerLookupsData = {
  statuses: DEFAULT_CUSTOMER_STATUSES,
  locationStatuses: DEFAULT_SUB_STATUSES,
  departmentStatuses: DEFAULT_SUB_STATUSES,
  contactStatuses: DEFAULT_SUB_STATUSES,
}

// Each field falls back independently via normalizeOptions — always returns a
// full, usable object (never null; a per-field default beats an all-or-nothing seed).
const mapCustomerLookups = (res: AxiosResponse): CustomerLookupsData => {
  const d = (unwrap(res) ?? {}) as Record<string, unknown>
  return {
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    statuses: normalizeOptions(d.statuses, DEFAULT_CUSTOMER_STATUSES, '#6B7280') ?? DEFAULT_CUSTOMER_STATUSES,
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    locationStatuses: normalizeOptions(d.location_statuses, DEFAULT_SUB_STATUSES, '#6B7280') ?? DEFAULT_SUB_STATUSES,
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    departmentStatuses: normalizeOptions(d.department_statuses, DEFAULT_SUB_STATUSES, '#6B7280') ?? DEFAULT_SUB_STATUSES,
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    contactStatuses: normalizeOptions(d.contact_statuses, DEFAULT_SUB_STATUSES, '#6B7280') ?? DEFAULT_SUB_STATUSES,
  }
}

export function useCustomerLookups() {
  const { data, loading } = useCachedLookup('/settings/customer-lookups', mapCustomerLookups, FALLBACK)

  // value → item helper with a neutral fallback so the UI never crashes.
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
  const metaIn = (list: LookupOption[]) => (v?: string | null): LookupOption => list.find(s => s.value === v) ?? { value: v ?? '', label: v || '—', color: '#9CA3AF' }

  return {
    statuses: data.statuses, statusMeta: metaIn(data.statuses),
    locationStatuses:   data.locationStatuses,   locationStatusMeta:   metaIn(data.locationStatuses),
    departmentStatuses: data.departmentStatuses, departmentStatusMeta: metaIn(data.departmentStatuses),
    contactStatuses:    data.contactStatuses,    contactStatusMeta:    metaIn(data.contactStatuses),
    loading,
  }
}
