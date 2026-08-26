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
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { normalizeOptions } from './lookupUtils'
import { translateSeedList } from './lookupSeedI18n'
import type { LookupOption } from '@/types/common'
import { unwrap } from '@/lib/api'
import { useMemo } from 'react'

// Seed defaults — the values shipped for new tenants and the fallback before the
// backend is ready. Colours match the calm light/dark scheme used across lookups.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
/**
 * Seed fallback, used ONLY while /customer-statuses is unreachable. The slugs must match
 * the backend seeder or a real status silently fails to resolve once the API answers.
 *
 * Corrected 02-08 on two counts: the slugs were Dutch while the backend seeds English
 * ones, and `prospect` was in here as a STATUS. Prospect is a PHASE now (Danny: "een klant
 * kan een prospect zijn of een klant") — leaving it here would have kept the very value
 * the split removes alive in every offline render.
 */
export const DEFAULT_CUSTOMER_STATUSES: LookupOption[] = [
  { value: 'active',   label: 'Actief',      color: '#16A34A' },
  { value: 'inactive', label: 'Inactief',    color: '#D97706' },
  { value: 'blocked',  label: 'Geblokkeerd', color: '#DC2626' },
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

// Tenant customer/location/department/contact status lookups, with translated seed
// fallbacks and a value→item meta helper per list (mirrors useGenders/useFunctions).
export function useCustomerLookups() {
  const { t } = useTranslation('common')
  const { data, loading } = useCachedLookup('/settings/customer-lookups', mapCustomerLookups, FALLBACK)

  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  // Memoised: consumers put these arrays in dependency arrays (§9 stable reference).
  const statuses           = useMemo(() => translateSeedList(t, 'customerStatuses', data.statuses), [data.statuses, t])
  // Same seed-translation treatment as `statuses` above, for locations.
  const locationStatuses   = useMemo(() => translateSeedList(t, 'subStatuses', data.locationStatuses), [data.locationStatuses, t])
  // Same seed-translation treatment as `statuses` above, for departments.
  const departmentStatuses = useMemo(() => translateSeedList(t, 'subStatuses', data.departmentStatuses), [data.departmentStatuses, t])
  const contactStatuses    = useMemo(() => translateSeedList(t, 'subStatuses', data.contactStatuses), [data.contactStatuses, t])

  // value → item helper with a neutral fallback so the UI never crashes.
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
  const metaIn = (list: LookupOption[]) => (v?: string | null): LookupOption => list.find(s => s.value === v) ?? { value: v ?? '', label: v || '—', color: '#9CA3AF' }

  return {
    statuses, statusMeta: metaIn(statuses),
    locationStatuses,   locationStatusMeta:   metaIn(locationStatuses),
    departmentStatuses, departmentStatusMeta: metaIn(departmentStatuses),
    contactStatuses,    contactStatusMeta:    metaIn(contactStatuses),
    loading,
  }
}
