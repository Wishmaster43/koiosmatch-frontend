/**
 * useIndustries — tenant-configurable industry list.
 *
 * Fed by the API (GET /industries) with a sensible package default as fallback
 * while the API is empty/unavailable. Managed in Settings → Personalisation →
 * Industries. Items are plain name strings (company stores the name).
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

export const DEFAULT_INDUSTRIES = [
  'Werving', 'Uitzendbureau', 'Horeca', 'Logistiek', 'Zorg',
  'IT', 'Bouw', 'Onderwijs', 'Financiën', 'Overig',
]

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapIndustries = (res: AxiosResponse): string[] | null => {
  const d = lookupNames(res)
  return d.length ? d : null
}

// Tenant industry list plus a picker-ready options array; raw names stay unsaved-untranslated so a picker never persists a display label.
export function useIndustries() {
  const { t } = useTranslation('common')
  const { data: rawIndustries } = useCachedLookup('/industries', mapIndustries, DEFAULT_INDUSTRIES)
  // LOOKUP-I18N-1 SAFETY: this list is VALUE and LABEL at once — the picker stores the
  // string it shows, so a translated entry would be SAVED and the record would carry
  // "Healthcare" instead of the seeded "Zorg" forever. The names therefore stay raw;
  // display sites translate at render through useSeedLabel (see CustomersTable), and
  // `*Options` below pairs the raw value with a translated label for the pickers.
  const industries = rawIndustries
  // Pairs each raw industry name with its translated label for pickers, without ever mutating the stored value itself.
  const industryOptions = useMemo(
    () => rawIndustries.map(name => ({ value: name, label: translateSeedLabel(t, 'industries', { label: name }) })),
    [rawIndustries, t],
  )
  return { industries, industryOptions }
}
