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
 *
 * LOOKUP-I18N-1 (25-08, fix round): `contactFunctions` is `{ value, label }[]`,
 * never a bare string[]. A seeded default's LABEL renders in the user's language,
 * but its VALUE stays the exact name the backend sent — that untranslated name is
 * what a picker's onChange emits and what gets written to `customer_contacts.function`
 * (a write gated against the tenant lookup via the dotted `contact_functions.
 * allow_free_entry` key, mirrors useApplicationSources.ts's own reasoning). Every
 * consumer already accepts `Array<string | { value; label }>` (CreatableSelect) or
 * reads `.value`/`.label` directly, so this is a drop-in, not a breaking change.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { lookupNames } from './lookupUtils'

// A picker option: `value` is the untranslated name the backend recognises;
// `label` is what the user sees (translated for a seeded default, unchanged for
// a tenant-typed one). Matches the shared CreatableSelect option shape 1:1.
export interface ContactFunctionOption { value: string; label: string }

export const DEFAULT_CONTACT_FUNCTIONS = [
  'Locatiemanager', 'Teamleider', 'HR-adviseur', 'Roosterplanner', 'Zorgcoördinator', 'Directeur',
]

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value (mirrors useFunctions.ts). The
// backend's OWN default for this lookup is FREE (ContactFunctionController::
// defaultFreeEntry() returns true) — mirror that as the pending seed, never strict.
interface ContactFunctionsLookupData { contactFunctions: string[]; apiFreeEntry: boolean }
const FALLBACK: ContactFunctionsLookupData = { contactFunctions: DEFAULT_CONTACT_FUNCTIONS, apiFreeEntry: true }

// Names keep the seed when empty; apiFreeEntry defaults STRICT when the response omits the flag
// the response doesn't carry a boolean flag (e.g. a genuinely empty/failed response).
const mapContactFunctions = (res: AxiosResponse): ContactFunctionsLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    contactFunctions: names.length ? names : DEFAULT_CONTACT_FUNCTIONS,
    // Danny 21-08 (settings round), translated: free entry is OFF by default —
    // strict is the norm, free entry is the deliberate exception a tenant
    // switches on itself.
    apiFreeEntry: typeof free === 'boolean' ? free : false,
  }
}

// The tenant's contact-person job-title lookup plus the free-entry flag, both
// read off the SAME cached response (see the file doc for the two-key pitfall this avoids).
export function useContactFunctions() {
  const { t } = useTranslation('common')
  const { data, invalidate } = useCachedLookup('/contact-functions', mapContactFunctions, FALLBACK)
  // Seeded defaults render in the user language; a tenant value stays as typed
  // (LOOKUP-I18N-1). VALUE stays the raw backend name (never translated) so the
  // submitted `function` is always what the backend recognises; only LABEL is
  // translated for display.
  const contactFunctions = useMemo(
    () => translateSeedList(t, 'contactFunctions', data.contactFunctions.map(name => ({ value: name, label: name }))),
    [data.contactFunctions, t],
  )
  return { contactFunctions, allowFreeEntry: data.apiFreeEntry, invalidate }
}
