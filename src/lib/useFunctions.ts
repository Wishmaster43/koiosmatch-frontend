/**
 * useFunctions — tenant-configurable job-function list (e.g. "Verzorgende IG").
 *
 * Fed by the API (GET /functions) with a healthcare default as fallback while the
 * API is empty/unavailable. Managed in Settings → Functies. Items are plain name
 * strings (the candidate/vacancy stores the name).
 *
 * FUNC-FREEENTRY-FIX (2026-08-17): `allowFreeEntry` is read straight off THIS SAME
 * response's `allow_free_entry` flag — never a second tenant-settings-blob key.
 * It used to be shadowed through `getBoolSetting(settings, 'functions_allow_free_entry',
 * ...)`, an UNDERSCORED key written by the generic `POST /settings` blob. That is a
 * DIFFERENT Setting row than the one the backend actually enforces: both
 * `FreeEntryLookupController::allowFreeEntry()` (this GET) and any write-time gate
 * on `candidates.function_title` read the DOTTED `functions.allow_free_entry` key,
 * written only by `PUT /functions/free-entry`. Wiring the underscored key here
 * reproduced the exact gap found on the sources lookup: the toggle read as "on" in
 * this app while the server enforced strict — see FunctionsSettings.jsx, which now
 * persists through the real dedicated route so this single response stays
 * authoritative (mirrors useApplicationSources.ts).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

export const DEFAULT_FUNCTIONS = [
  'Helpende', 'Helpende Plus', 'Verzorgende', 'Verzorgende IG', "EVV'er",
  'Verpleegkundige N4', 'Verpleegkundige N5', 'Wijkverpleegkundige', 'Doktersassistent',
]

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value. The backend's own default
// (before any tenant has toggled it) is strict — mirror that as the pending seed.
interface FunctionsLookupData { functions: string[]; apiFreeEntry: boolean }
const FALLBACK: FunctionsLookupData = { functions: DEFAULT_FUNCTIONS, apiFreeEntry: false }

// Names keep the seed when empty; apiFreeEntry keeps the strict default when the
// response doesn't carry a boolean flag (e.g. a genuinely empty/failed response).
const mapFunctions = (res: AxiosResponse): FunctionsLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    functions: names.length ? names : DEFAULT_FUNCTIONS,
    apiFreeEntry: typeof free === 'boolean' ? free : false,
  }
}

export function useFunctions() {
  const { data, invalidate } = useCachedLookup('/functions', mapFunctions, FALLBACK)
  return { functions: data.functions, allowFreeEntry: data.apiFreeEntry, invalidate }
}
