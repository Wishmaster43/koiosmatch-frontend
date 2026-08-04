/**
 * useCountriesLookup — GET /countries (COUNTRY-LOOKUP-1), the platform's operating-
 * country whitelist (backend App\Support\CountryCode), replacing CompanySettings'
 * own hardcoded 4-country name list ('Netherlands'/'Belgium'/'Germany'/'United
 * Kingdom'). The backend seeds `company_country` as an ISO-2 CODE ('NL',
 * DevResetCommand.php) but the old FE list stored/matched full English NAMES — a
 * seeded 'NL' never matched any option, so the picker silently showed the raw
 * code instead of a name (CMBE 04-08: "render wat de backend kent").
 *
 * CODES come from this endpoint; DISPLAY names are resolved through the existing
 * `getCountryName(code, lang)` (lib/countries.ts, Intl.DisplayNames — already used
 * for the candidate's own ISO-2 country field) rather than the backend's Dutch-
 * only `name` field, so every locale gets a correctly translated label with zero
 * new i18n keys and zero risk of drifting from the candidate's own country list.
 *
 * Platform data, not tenant-configurable (open read, no write path) — cached for
 * the session via useCachedLookup, same convention as useProvinces/useIndustries.
 */
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { unwrapList } from '@/lib/api'
import { getCountryName } from '@/lib/countries'

export interface CountryOption {
  value: string
  label: string
}

// The backend's own seeded operating-country whitelist (CountryController::NAMES,
// codes only — mirrors what a fresh tenant sees before the endpoint resolves).
const FALLBACK_CODES = ['NL', 'BE', 'DE', 'FR', 'ES', 'GB', 'IE']

// Parse {data:[{code,name}]} into bare ISO-2 codes — the backend's own `name` is
// deliberately dropped (Dutch-only, not locale-aware); see file header. Empty
// response = nothing usable (this endpoint is never legitimately empty) — keep
// the fallback and don't cache.
function mapCodes(res: AxiosResponse): string[] | null {
  const raw = unwrapList(res).rows as Array<Record<string, unknown> | string>
  if (!raw.length) return null
  const codes = raw
    .map(row => (typeof row === 'string' ? row : String((row as Record<string, unknown>).code ?? '')))
    .filter(Boolean)
  return codes.length ? codes : null
}

export function useCountriesLookup() {
  const { i18n } = useTranslation()
  const { data: codes, loading } = useCachedLookup('/countries', mapCodes, FALLBACK_CODES)
  // Resolve each code to its display name in the CURRENT app language every
  // render (cheap — a handful of rows) so a live language switch relabels instantly.
  const options: CountryOption[] = codes.map(code => ({ value: code, label: getCountryName(code, i18n.language) }))
  return { options, loading }
}
