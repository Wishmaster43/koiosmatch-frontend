/**
 * useContactFunctions — tenant-configurable job-title list for CONTACT PERSONS at a
 * customer (e.g. "Locatiemanager", "Teamleider"), split from the candidate function
 * list (FUNCTIONS-SPLIT-1, Danny 2026-07-20) — the two vocabularies serve different
 * people and must not share one lookup.
 *
 * Fed by the API (GET /contact-functions) with a healthcare-org default as fallback
 * while the API is empty/unavailable.
 *
 * FUNC-FREEENTRY-FIX (2026-08-17): `allowFreeEntry` is read straight off THIS SAME
 * response's `allow_free_entry` flag — never a second tenant-settings-blob key. It
 * used to be shadowed through `getBoolSetting(settings, 'contact_functions_allow_free_entry',
 * ...)`, an UNDERSCORED key written by the generic `POST /settings` blob. That is a
 * DIFFERENT Setting row than the one the backend actually enforces: both
 * `FreeEntryLookupController::allowFreeEntry()` (this GET) and
 * `CustomerContactController`'s write-time gate on `customer_contacts.function` read
 * the DOTTED `contact_functions.allow_free_entry` key, written only by
 * `PUT /contact-functions/free-entry`. Wiring the underscored key here reproduced
 * the exact gap found on the sources lookup — see ContactFunctionsSettings.jsx,
 * which now persists through the real dedicated route (mirrors useApplicationSources.ts).
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

export const DEFAULT_CONTACT_FUNCTIONS = [
  'Locatiemanager', 'Teamleider', 'HR-adviseur', 'Roosterplanner', 'Zorgcoördinator', 'Directeur',
]

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value (mirrors useFunctions.ts). The
// backend's OWN default for this lookup is FREE (ContactFunctionController::
// defaultFreeEntry() returns true) — mirror that as the pending seed, never strict.
interface ContactFunctionsLookupData { contactFunctions: string[]; apiFreeEntry: boolean }
const FALLBACK: ContactFunctionsLookupData = { contactFunctions: DEFAULT_CONTACT_FUNCTIONS, apiFreeEntry: true }

// Names keep the seed when empty; apiFreeEntry keeps the backend's own default when
// the response doesn't carry a boolean flag (e.g. a genuinely empty/failed response).
const mapContactFunctions = (res: AxiosResponse): ContactFunctionsLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    contactFunctions: names.length ? names : DEFAULT_CONTACT_FUNCTIONS,
    apiFreeEntry: typeof free === 'boolean' ? free : true,
  }
}

export function useContactFunctions() {
  const { data, invalidate } = useCachedLookup('/contact-functions', mapContactFunctions, FALLBACK)
  return { contactFunctions: data.contactFunctions, allowFreeEntry: data.apiFreeEntry, invalidate }
}
