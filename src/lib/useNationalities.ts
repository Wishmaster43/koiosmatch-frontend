/**
 * useNationalities — tenant-configurable nationality lookup.
 *
 * Fed by the API (GET /nationalities) with a Dutch-market default as fallback
 * while the API is empty/unavailable (CFG-1). Managed in Settings → Nationaliteiten.
 * Items are plain name strings (the candidate stores the name).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 *
 * LOOKUP-ICON-1 (batch 12, P22-30, decision 22-30-vlaggen "emoji passthrough"):
 * each row also carries an optional ISO-2 `country_code` (NATION-FLAG-1, already
 * consumed by NationalitiesSettings' row prefix). This hook now resolves that
 * code to a flag EMOJI per nationality name via `getFlagEmoji` and exposes it as
 * `flags` (name → emoji), so ProfilePersonalTab can render it through the shared
 * LookupIcon (emoji passthrough) without a second network call — one mapFn keeps
 * writing ONE cache entry for '/nationalities' (useCachedLookup keys purely by
 * URL, so a second differently-shaped hook on the same endpoint would race it).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'
import { getFlagEmoji } from './countries'
import { translateSeedLabel } from './lookupSeedI18n'

export const DEFAULT_NATIONALITIES = [
  'Nederlands', 'Belgisch', 'Duits', 'Frans', 'Brits', 'Pools', 'Turks',
  'Marokkaans', 'Surinaams', 'Antilliaans', 'Overig',
]

interface NationalitiesData { names: string[]; flags: Record<string, string> }

const DEFAULT_DATA: NationalitiesData = { names: DEFAULT_NATIONALITIES, flags: {} }

type Named = { name?: string; label?: string; value?: string; country_code?: string }

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapNationalities = (res: AxiosResponse): NationalitiesData | null => {
  const raw = (unwrapList(res).rows) as unknown[]
  const names: string[] = []
  const flags: Record<string, string> = {}
  raw.forEach(x => {
    if (typeof x === 'string') { names.push(x); return }
    const n = x as Named
    const name = n.name ?? n.label ?? n.value
    if (!name) return
    names.push(name)
    const flag = getFlagEmoji(n.country_code)
    if (flag) flags[name] = flag
  })
  return names.length ? { names, flags } : null
}

export function useNationalities() {
  const { t } = useTranslation('common')
  const { data } = useCachedLookup('/nationalities', mapNationalities, DEFAULT_DATA)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  // Flags are re-keyed onto the translated name so `flags[name]` still resolves for callers
  // that look the flag up by the (possibly translated) name coming back from this hook.
  const translated = useMemo(() => {
    // LOOKUP-I18N-1 SAFETY: the picker saves the string it shows, so the stored names stay
    // raw and only `options` carries a translated label (display sites use useSeedLabel).
    const names = data.names
    const options = data.names.map(name => ({ value: name, label: translateSeedLabel(t, 'nationalities', { label: name }) }))
    const flags: Record<string, string> = {}
    data.names.forEach((name, i) => {
      const flag = data.flags[name]
      if (flag) flags[names[i]] = flag
    })
    return { names, options, flags }
  }, [data, t])

  return { nationalities: translated.names, nationalityOptions: translated.options, flags: translated.flags }
}
