/**
 * demoSeedTexts — DEMO-SEED-TAAL-1 (Danny 27-08: "DEMO MOET IN ALLE TALEN GEGEVEN
 * KUNNEN WORDEN GELDT DUS VOOR ALLE DATA!!"). The demo tenant's seeded free texts
 * (candidate profile summaries, vacancy descriptions, customer company texts) are
 * DUTCH prose in the database — translating them for real is a live AI call, and
 * API-CREDITS-1 forbids any FE/CMFE session from spending those. So this is a pure
 * DISPLAY-time swap: a small FE catalogue maps the exact seeded Dutch text to a
 * pre-written translation per language, mirroring the rename-guard idiom of
 * lookupSeedI18n.ts (read that file first) but for free text instead of lookup
 * labels — a normalized-text match instead of a lookup key, since free text has
 * no stable id to key off.
 *
 * Zero DB/seeder changes, zero cost for real tenants: the catalogue chunk is only
 * ever requested for the demo tenant AND a non-Dutch UI language, and a tenant
 * edit (the text no longer matches a catalogue key byte-for-byte after
 * normalization) always wins and passes through untouched.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getActiveTenantId } from '@/lib/api'

// The tenant id the demo seed lives under — matches the X-Tenant header value.
const DEMO_TENANT_ID = 'demo'

// Compare seeded text the way the catalogue keys were generated: outer trim +
// inner whitespace (including newlines) collapsed to single spaces, so a
// multi-paragraph markdown text still matches regardless of exact line breaks.
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

type Catalogue = Record<string, string>

// One dynamic import per language, cached at module scope so a language is
// never fetched twice and real-tenant/nl sessions never fetch one at all.
const catalogueLoaders: Record<string, () => Promise<{ default: Catalogue }>> = {
  de: () => import('./de'),
  fr: () => import('./fr'),
  es: () => import('./es'),
  en: () => import('./en'),
}
const catalogueCache = new Map<string, Catalogue>()
const catalogueInflight = new Map<string, Promise<Catalogue>>()

// Fetch (or reuse) a language's catalogue, deduplicating concurrent requests.
function loadCatalogue(lang: string): Promise<Catalogue> {
  const cached = catalogueCache.get(lang)
  if (cached) return Promise.resolve(cached)
  const inflight = catalogueInflight.get(lang)
  if (inflight) return inflight
  const loader = catalogueLoaders[lang]
  if (!loader) return Promise.resolve({})
  const promise = loader().then(mod => {
    catalogueCache.set(lang, mod.default)
    catalogueInflight.delete(lang)
    return mod.default
  })
  catalogueInflight.set(lang, promise)
  return promise
}

/**
 * useSeedText — translates a demo-tenant seeded free text on display, for a
 * non-Dutch UI language, when the text still matches its seeded Dutch original.
 * Any other case (real tenant, Dutch UI, edited/unknown text, empty input)
 * returns the input verbatim.
 */
export function useSeedText(text: string | null | undefined): string {
  const { i18n } = useTranslation()
  const lang = i18n.language
  // Only the demo tenant, only a non-Dutch language, ever needs a catalogue —
  // this guard alone keeps real tenants and nl sessions from loading a chunk.
  const active = Boolean(text) && getActiveTenantId() === DEMO_TENANT_ID && lang !== 'nl' && Boolean(catalogueLoaders[lang])
  // The state carries WHICH language its map belongs to (Opus F5): on a
  // de -> fr switch the stale German map must never paint a frame of German
  // prose while the French chunk is still loading — a mismatched lang falls
  // back to the source text until the right chunk lands.
  const [loaded, setLoaded] = useState<{ lang: string; map: Catalogue } | null>(() => {
    const cached = active ? catalogueCache.get(lang) : undefined
    return cached ? { lang, map: cached } : null
  })

  // Lazily fetch the language chunk once, only when actually needed; re-renders
  // when it arrives so the translation appears without a page reload.
  useEffect(() => {
    if (!active) { setLoaded(null); return }
    const cached = catalogueCache.get(lang)
    if (cached) { setLoaded({ lang, map: cached }); return }
    let alive = true
    loadCatalogue(lang).then(c => { if (alive) setLoaded({ lang, map: c }) })
    return () => { alive = false }
  }, [active, lang])

  if (!active || !text || !loaded || loaded.lang !== lang) return text ?? ''
  const key = normalize(text)
  return loaded.map[key] ?? text
}
