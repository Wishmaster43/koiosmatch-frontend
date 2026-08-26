/**
 * useCustomerPhases — the customer LIFECYCLE PHASE lookup (KLANT-FASE-1), the exact
 * counterpart of the candidate phase axis: "is this a prospect or a real customer?".
 * A different question than the customer STATUS axis ("can we do business with them
 * today?"), so the two are shown side by side and never collapsed into one field.
 *
 * Backend (verified 2026-08-02): GET /customer-phases → a plain array of
 * {id,value,label,color,sort_order,active,is_customer,is_default,in_use}; the
 * customer carries the bare slug in `phase` (customers.phase → customer_phases.value).
 * Full CRUD + reorder live behind settings.update (routes/api/tenant/core-lookups.php).
 *
 * BEHAVIOUR FLAGS, NEVER SLUGS (§3B): `is_customer` marks the phase that counts as a
 * real customer (mirrors candidate_phases.is_applicant) and `is_default` the phase a
 * new customer starts in. A tenant may rename "Klant" to anything; the flags survive
 * that, a slug comparison would not.
 *
 * Fetch/cache/dedupe lives in useCachedLookup — one GET per session, shared by the
 * table, the drawer picker and the create modal.
 */
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { sortActiveRows } from './lookupUtils'
import { unwrapList } from '@/lib/api'
import type { LookupOption } from '@/types/common'

/** One phase row: the shared lookup shape plus the two behaviour flags. */
export interface CustomerPhaseOption extends LookupOption {
  isCustomer: boolean
  isDefault: boolean
}

// Seed fallback — mirrors the backend's CustomerLookupSeeder so the UI is usable
// before/without the API. Slugs are the stable English-ish backend values; the
// labels/colours a tenant sees normally come from the API.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_CUSTOMER_PHASES: CustomerPhaseOption[] = [
  { value: 'prospect', label: 'Prospect', color: '#1B60A9', isCustomer: false, isDefault: true },
  { value: 'klant',    label: 'Klant',    color: '#16A34A', isCustomer: true,  isDefault: false },
]
/* eslint-enable no-restricted-syntax */

// Raw rows → option shape. Returns null when the response carries nothing usable, so
// useCachedLookup keeps the seed and retries on the next mount (never caches an empty).
const mapPhases = (res: AxiosResponse): CustomerPhaseOption[] | null => {
  const rows = sortActiveRows(unwrapList(res).rows)
  if (rows.length === 0) return null
  return rows.map(it => ({
    id: it.id as string | number | undefined,
    value: String(it.value ?? ''),
    label: String(it.label ?? it.name ?? it.value ?? ''),
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    color: (it.color as string) ?? '#9CA3AF',
    isCustomer: it.is_customer === true,
    isDefault: it.is_default === true,
  }))
}

// The customer-phase tenant lookup, translating seeded defaults into the user language while a tenant's own value stays exactly as typed.
export function useCustomerPhases() {
  const { t } = useTranslation('common')
  const { data: rawPhases, loading } = useCachedLookup('/customer-phases', mapPhases, DEFAULT_CUSTOMER_PHASES)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const phases = useMemo(() => translateSeedList(t, 'customerPhases', rawPhases), [rawPhases, t])

  // slug → row, with a neutral fallback so an unknown/retired phase still renders
  // useCallback: consumers hang this in memo deps (mirrors useGenders' colorOf).
  const phaseMeta = useCallback((v?: string | null): CustomerPhaseOption => (
    phases.find(p => p.value === v)
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    ?? { value: v ?? '', label: v || '', color: '#9CA3AF', isCustomer: false, isDefault: false }
  ), [phases])

  // The phase a new customer starts in — read off the FLAG, falling back to the
  // first row so the create form is never left without a selection.
  const defaultPhase = phases.find(p => p.isDefault)?.value ?? phases[0]?.value ?? ''

  // "Is this record a real customer (not a prospect)?" — flag-driven, so a tenant
  // renaming the phase label never breaks the answer.
  const isCustomerPhase = useCallback((v?: string | null): boolean => (
    phases.find(p => p.value === v)?.isCustomer === true
  ), [phases])

  return { phases, phaseMeta, defaultPhase, isCustomerPhase, loading }
}
