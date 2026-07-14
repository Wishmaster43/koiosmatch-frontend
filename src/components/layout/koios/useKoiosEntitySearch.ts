/**
 * useKoiosEntitySearch — live per-category lookup for the "@" composer
 * (KOIOS-SEARCH-1), generalized from the candidates-only pilot
 * (useKoiosCandidateSearch). Looks up the category's wiring in
 * koiosMentionCategories.ts (endpoint/param/extraParams/present) and reuses the
 * SAME list endpoint that entity's own page already searches with — never a
 * second implementation. Debounced ~250ms and abort-guarded exactly like the
 * pilot: a stale reply can never overwrite a newer one. Categories with no
 * `search` config (today: `locations` — no global list endpoint, see the file
 * comment) report `unsupported: true` and never call the API.
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'
import { MENTION_CATEGORIES } from './koiosMentionCategories'

export interface KoiosEntityHit {
  id: string
  name: string
  subtitle?: string
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const RESULT_CAP = 5

export function useKoiosEntitySearch(categoryId: string, query: string) {
  const [results, setResults] = useState<KoiosEntityHit[]>([])
  const [loading, setLoading] = useState(false)
  const config = MENTION_CATEGORIES.find((c) => c.id === categoryId)?.search

  useEffect(() => {
    const q = query.trim()
    // No search wiring for this category (measured gap) — never hit the API.
    if (!config) { setResults([]); setLoading(false); return }
    if (q.length < MIN_QUERY_LENGTH) { setResults([]); setLoading(false); return }

    let alive = true
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      api.get(config.endpoint, {
        params: { [config.param]: q, per_page: RESULT_CAP, ...config.extraParams },
        signal: controller.signal,
      })
        .then((res) => {
          if (!alive) return
          const rows = unwrapList<Record<string, unknown>>(res).rows
          setResults(rows.slice(0, RESULT_CAP).map(config.present))
        })
        .catch(() => { if (alive) setResults([]) })
        .finally(() => { if (alive) setLoading(false) })
    }, DEBOUNCE_MS)

    return () => { alive = false; clearTimeout(timer); controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, query])

  return { results, loading, unsupported: !config }
}
