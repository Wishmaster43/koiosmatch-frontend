/**
 * useCustomerSources — the searchable/creatable option list for the customer
 * "source" field (acquisition channel: LinkedIn, Google, Website leads, …).
 *
 * CUST-SOURCE-FE-1 (BE landed 22-08, c7c39a2e): mirrors useApplicationSources
 * 1:1 against its own tenant-CRUD lookup, `GET /customer-sources`
 * (CustomerSourceController, the same FreeEntryLookupController base — CRUD +
 * reorder + in-use 409 + a free-entry toggle via `PUT /customer-sources/free-entry`).
 * See useApplicationSources.ts's own doc comment for the full reasoning behind
 * every choice below (permissive-while-unknown, the dedicated-route free-entry
 * write, why `sources` is `{value,label}` not a bare string[]) — it all applies
 * here unchanged, just against `customers.source` instead of `candidates.source`
 * / `applications.source`.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { lookupNames } from './lookupUtils'

// A picker option: `value` is the untranslated name the backend recognises;
// `label` is what the user sees. Matches the shared CreatableSelect option shape 1:1.
export interface CustomerSourceOption { value: string; label: string }

// Small starter seed shown before any real /customer-sources data has loaded
// (data values, not UI copy — same treatment as DEFAULT_APPLICATION_SOURCES).
export const DEFAULT_CUSTOMER_SOURCES = ['LinkedIn', 'Google', 'Website leads']

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value.
interface SourcesLookupData { sources: string[]; apiFreeEntry: boolean }
const FALLBACK: SourcesLookupData = { sources: DEFAULT_CUSTOMER_SOURCES, apiFreeEntry: true }

// Names keep the seed when empty; apiFreeEntry defaults STRICT when the response
// carries no boolean flag (a genuinely empty or failed response), per the
// FREE-ENTRY-FALLBACK-1 reasoning in useApplicationSources.ts.
const mapSources = (res: AxiosResponse): SourcesLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    sources: names.length ? names : DEFAULT_CUSTOMER_SOURCES,
    apiFreeEntry: typeof free === 'boolean' ? free : false,
  }
}

// Tenant customer-source lookup with its own free-entry toggle, defaulting to strict when the response omits the flag.
export function useCustomerSources() {
  const { t } = useTranslation('common')
  const { data, invalidate } = useCachedLookup('/customer-sources', mapSources, FALLBACK)
  // Seeded defaults render in the user language; a tenant value stays as typed.
  // VALUE stays the raw backend name (never translated) so the submitted `source`
  // is always what the backend recognises; only LABEL is translated for display.
  const sources = useMemo(
    () => translateSeedList(t, 'customerSources', data.sources.map(name => ({ value: name, label: name }))),
    [data.sources, t],
  )
  return { sources, allowFreeEntry: data.apiFreeEntry, invalidate }
}
