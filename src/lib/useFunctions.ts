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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'
import { translateSeedLabel } from './lookupSeedI18n'

// ONTZORGING (K-178, Danny 24-08: the product is GENERAL staffing — care is one
// segment, never the default): the server seeds the functions lookup EMPTY
// (creatable combobox, bureaus fill their own list), so the FE fallback follows.
// The old care-specific emergency list would resurface sector defaults the
// platform deliberately no longer ships.
export const DEFAULT_FUNCTIONS: string[] = []

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value. The backend's own default
// (before any tenant has toggled it) is strict — mirror that as the pending seed.
interface FunctionsLookupData { functions: string[]; apiFreeEntry: boolean }
// FREE-ENTRY-FALLBACK-1: the pending/unknown value is PERMISSIVE, matching the
// contact-functions lookup and the sources lookup. Strict-while-unknown means "no
// value is valid", which locks a recruiter out of a field for a reason they cannot
// see: before the response lands, when it fails, or on a tenant whose list is still
// empty. The backend proved this the hard way on 15-08, when its sources rule
// inherited a strict default against an empty table and answered 422 on four write
// paths. Being briefly too permissive costs a value the server can still reject;
// being briefly too strict costs the user the ability to work at all.
const FALLBACK: FunctionsLookupData = { functions: DEFAULT_FUNCTIONS, apiFreeEntry: true }

// Names keep the seed when empty; apiFreeEntry defaults STRICT when the response omits the flag
// response doesn't carry a boolean flag (e.g. a genuinely empty/failed response).
const mapFunctions = (res: AxiosResponse): FunctionsLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    functions: names.length ? names : DEFAULT_FUNCTIONS,
    // Danny 21-08 (settings round), verbatim: "…STANDAARD UIT…" — i.e. free
    // entry is OFF by default: strict is the norm, free entry is the
    // deliberate exception a tenant switches on itself.
    apiFreeEntry: typeof free === 'boolean' ? free : false,
  }
}

// Cached tenant function-name lookup + the API's own free-entry flag (see the module doc above for why they must come from the same response).
export function useFunctions() {
  const { t } = useTranslation('common')
  const { data, invalidate } = useCachedLookup('/functions', mapFunctions, FALLBACK)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  // LOOKUP-I18N-1 SAFETY: this list is VALUE and LABEL at once — the picker stores the
  // string it shows, so a translated entry would be SAVED and the record would carry
  // "Healthcare" instead of the seeded "Zorg" forever. The names therefore stay raw;
  // display sites translate at render through useSeedLabel (see the candidate row), and
  // `*Options` below pairs the raw value with a translated label for the pickers.
  const functions = data.functions
  // Pairs each raw stored name with a translated display label for the pickers, without mutating the stored value itself (see the LOOKUP-I18N-1 safety note above).
  const functionOptions = useMemo(
    () => data.functions.map(name => ({ value: name, label: translateSeedLabel(t, 'functions', { label: name }) })),
    [data.functions, t],
  )
  return { functions, functionOptions, allowFreeEntry: data.apiFreeEntry, invalidate }
}
