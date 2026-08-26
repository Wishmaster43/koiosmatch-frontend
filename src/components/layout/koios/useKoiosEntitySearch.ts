/**
 * useKoiosEntitySearch — live per-category lookup for the "@" composer
 * (KOIOS-SEARCH-1), generalized from the candidates-only pilot
 * (useKoiosCandidateSearch). Looks up the category's wiring in
 * koiosMentionCategories.ts (endpoint/param/extraParams/present) and reuses the
 * SAME list endpoint that entity's own page already searches with — never a
 * second implementation. Debounced ~250ms and abort-guarded exactly like the
 * pilot: a stale reply can never overwrite a newer one. A category with no
 * `search` config reports `unsupported: true` and never calls the API — every
 * MENTION_CATEGORIES entry is wired today, this stays defensive for a future
 * one that isn't yet.
 *
 * `fetchCategoryHits` is the actual list-endpoint call for ONE category — split
 * out so the DEFAULT fan-out search (useKoiosMultiEntitySearch, KOIOS-MENTION-
 * BREED-1) reuses the exact same endpoint/param/present wiring instead of
 * forking it; this hook's own single-category behaviour is unchanged.
 *
 * A real request failure (network/5xx) is reported as `error: true`, distinct
 * from a genuine zero-hit result — an aborted/superseded request (StrictMode,
 * a newer keystroke) is never treated as a failure. `retry()` re-fires the
 * exact same category/query without waiting for the query to change.
 */
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import api, { unwrapList } from '@/lib/api'
import { MENTION_CATEGORIES } from './koiosMentionCategories'

export interface KoiosEntityHit {
  id: string
  name: string
  subtitle?: string
}

export const MIN_QUERY_LENGTH = 2
export const DEBOUNCE_MS = 250
export const RESULT_CAP = 5

export interface KoiosCategoryFetchResult {
  hits: KoiosEntityHit[]
  error: boolean
}

// The actual list-endpoint call for ONE category. Never throws — resolves to
// `{ hits: [], error: false }` for an unwired category, and `{ hits: [], error:
// true }` for a genuine failure (an abort/cancel is NOT a failure: the caller
// itself superseded the request, so it reports success-with-nothing).
export function fetchCategoryHits(categoryId: string, query: string, signal?: AbortSignal): Promise<KoiosCategoryFetchResult> {
  const config = MENTION_CATEGORIES.find((c) => c.id === categoryId)?.search
  if (!config) return Promise.resolve({ hits: [], error: false })
  return api.get(config.endpoint, {
    params: { [config.param]: query, per_page: RESULT_CAP, ...config.extraParams },
    signal,
  })
    .then((res) => {
      const rows = unwrapList<Record<string, unknown>>(res).rows
      const hits = rows.map(config.present)
      // Guard the duplicate-id edge (KOIOS-SEARCH-FIX-2): two rows sharing an
      // id within the same category would collide in the mention menu's
      // key-by-group+id option map (one DOM id, the wrong row highlighted) —
      // dedupe once here, at the single source both search hooks share, before
      // the cap so a genuine duplicate never eats a real result's slot.
      const seenIds = new Set<string>()
      const deduped = hits.filter((h) => (seenIds.has(h.id) ? false : (seenIds.add(h.id), true)))
      return { hits: deduped.slice(0, RESULT_CAP), error: false }
    })
    .catch((err) => ({ hits: [], error: !axios.isCancel(err) }))
}

// Debounced, abortable @-mention search for one category in the Koios composer;
// exposes a retry() so a failed search can be re-run without the query changing.
export function useKoiosEntitySearch(categoryId: string, query: string) {
  const [results, setResults] = useState<KoiosEntityHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  // Bumped by retry() to re-fire the effect without the query itself changing.
  const [retryTick, setRetryTick] = useState(0)
  const config = MENTION_CATEGORIES.find((c) => c.id === categoryId)?.search

  // Debounce the query and abort the in-flight request on every keystroke/category
  // switch/retry, so a stale response can never overwrite a newer one.
  useEffect(() => {
    const q = query.trim()
    // No search wiring for this category (measured gap) — never hit the API.
    if (!config) { setResults([]); setLoading(false); setError(false); return }
    if (q.length < MIN_QUERY_LENGTH) { setResults([]); setLoading(false); setError(false); return }

    let alive = true
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    const timer = setTimeout(() => {
      fetchCategoryHits(categoryId, q, controller.signal)
        .then(({ hits, error: failed }) => { if (alive) { setResults(hits); setError(failed) } })
        .finally(() => { if (alive) setLoading(false) })
    }, DEBOUNCE_MS)

    return () => { alive = false; clearTimeout(timer); controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, query, retryTick])

  // Bumping the tick re-runs the search effect above without needing a query change.
  const retry = useCallback(() => setRetryTick((t) => t + 1), [])
  return { results, loading, unsupported: !config, error, retry }
}
