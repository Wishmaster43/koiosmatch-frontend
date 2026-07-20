/**
 * useContactFunctions — tenant-configurable job-title list for CONTACT PERSONS at a
 * customer (e.g. "Locatiemanager", "Teamleider"), split from the candidate function
 * list (FUNCTIONS-SPLIT-1, Danny 2026-07-20) — the two vocabularies serve different
 * people and must not share one lookup.
 *
 * Fed by the API (GET /contact-functions) with a healthcare-org default as fallback
 * while the API is empty/unavailable — the backend endpoint is requested and may
 * not be deployed everywhere yet; useCachedLookup's silent catch already keeps the
 * seed until it lands (mirrors useFunctions.ts exactly). The generated OpenAPI spec
 * for this route documents only the request shape/401 today (no 2xx schema yet, §10
 * of CLAUDE.md), so the response is still hand-mapped here.
 *
 * `allowFreeEntry` stays creatable (true) until a tenant setting exists for this
 * list — no Settings toggle ships yet — but the API's own `allow_free_entry` flag
 * wins the moment the backend starts sending one, so nothing needs to change here.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

export const DEFAULT_CONTACT_FUNCTIONS = [
  'Locatiemanager', 'Teamleider', 'HR-adviseur', 'Roosterplanner', 'Zorgcoördinator', 'Directeur',
]

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value (mirrors useFunctions.ts).
interface ContactFunctionsLookupData { contactFunctions: string[]; apiFreeEntry: boolean | null }
const FALLBACK: ContactFunctionsLookupData = { contactFunctions: DEFAULT_CONTACT_FUNCTIONS, apiFreeEntry: null }

// Always returns a usable object (never null): names keep the seed when empty,
// apiFreeEntry keeps null when absent — same independent fallbacks as useFunctions.ts.
const mapContactFunctions = (res: AxiosResponse): ContactFunctionsLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    contactFunctions: names.length ? names : DEFAULT_CONTACT_FUNCTIONS,
    apiFreeEntry: typeof free === 'boolean' ? free : null,
  }
}

export function useContactFunctions() {
  const { data } = useCachedLookup('/contact-functions', mapContactFunctions, FALLBACK)

  // No tenant toggle exists yet for this list, so default to creatable; the API
  // flag wins the moment the backend sends one (same fallback chain as useFunctions.ts
  // minus the Settings-toggle step, which has no UI for this list yet).
  const allowFreeEntry = data.apiFreeEntry ?? true

  return { contactFunctions: data.contactFunctions, allowFreeEntry }
}
