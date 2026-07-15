/**
 * useFunctions — tenant-configurable job-function list (e.g. "Verzorgende IG").
 *
 * Fed by the API (GET /functions) with a healthcare default as fallback while the
 * API is empty/unavailable. Managed in Settings → Functies. Items are plain name
 * strings (the candidate/vacancy stores the name). `allowFreeEntry` = creatable
 * combobox (true) vs strict dropdown (false): the tenant toggle (setting
 * `functions_allow_free_entry`) wins, else the API flag, else **false** (strict default).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'
import { useAllSettings, getBoolSetting } from './settings/useAllSettings'

export const DEFAULT_FUNCTIONS = [
  'Helpende', 'Helpende Plus', 'Verzorgende', 'Verzorgende IG', "EVV'er",
  'Verpleegkundige N4', 'Verpleegkundige N5', 'Wijkverpleegkundige', 'Doktersassistent',
]

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value.
interface FunctionsLookupData { functions: string[]; apiFreeEntry: boolean | null }
const FALLBACK: FunctionsLookupData = { functions: DEFAULT_FUNCTIONS, apiFreeEntry: null }

// Always returns a usable object (never null): names keep the seed when empty,
// apiFreeEntry keeps null when absent — same independent fallbacks as before.
const mapFunctions = (res: AxiosResponse): FunctionsLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    functions: names.length ? names : DEFAULT_FUNCTIONS,
    apiFreeEntry: typeof free === 'boolean' ? free : null,
  }
}

export function useFunctions() {
  const settings = useAllSettings()
  const { data } = useCachedLookup('/functions', mapFunctions, FALLBACK)

  // The Settings → Functies toggle is the source of truth; fall back to the API flag, then
  // false — strict by default (clean vocab for matching/AI; the backend default is OFF too).
  const allowFreeEntry = getBoolSetting(settings, 'functions_allow_free_entry', data.apiFreeEntry ?? false)

  return { functions: data.functions, allowFreeEntry }
}
