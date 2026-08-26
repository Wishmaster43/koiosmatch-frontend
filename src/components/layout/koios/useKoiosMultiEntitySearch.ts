/**
 * useKoiosMultiEntitySearch — the DEFAULT "@" search's fan-out (KOIOS-MENTION-
 * BREED-1, Danny, translated: "@ must search across all main entities" —
 * verbatim: "@ moet op alle hoofdobjecten zoeken" — the default search
 * used to query candidates only, KoiosMentionMenu.tsx). Once ≥2 characters are
 * typed with no category chosen, this fires ONE request per VISIBLE category
 * with search wiring (koiosMentionCategories.ts + koiosMentionAccess), reusing
 * the exact same fetch as the single-category useKoiosEntitySearch
 * (fetchCategoryHits — never forked) and its debounce/cap contract. Each
 * category gets its OWN AbortController, so one slow or failing category can
 * never sink or delay the rest — its group reports its OWN `error`, never a
 * silent empty.
 *
 * Every group is only flipped to `loading: true` once the debounce actually
 * FIRES, not on every keystroke — a fast typist keeps seeing the previous
 * query's results (stale but visible) instead of the whole list flashing to a
 * loading skeleton on every character.
 *
 * `retry()` re-fires the current category set/query — used for a single
 * "try again" that recovers every failed group at once (KoiosMentionMenu).
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchCategoryHits, MIN_QUERY_LENGTH, DEBOUNCE_MS } from './useKoiosEntitySearch'
import type { KoiosEntityHit } from './useKoiosEntitySearch'

export interface KoiosCategoryResult {
  results: KoiosEntityHit[]
  loading: boolean
  error: boolean
}

export interface KoiosMultiEntitySearchResult {
  groups: Record<string, KoiosCategoryResult>
  retry: () => void
}

// Fan out one search request per visible category so an unscoped '@' query searches every entity at once.
export function useKoiosMultiEntitySearch(categoryIds: string[], query: string): KoiosMultiEntitySearchResult {
  const [state, setState] = useState<Record<string, KoiosCategoryResult>>({})
  const [retryTick, setRetryTick] = useState(0)
  // A stable string key so the effect only re-fires when the SET of categories
  // actually changes, not on every render's fresh array literal from the caller.
  const idsKey = categoryIds.join(',')

  // Debounce the fan-out fetch; only mark groups loading once the timer fires so fast typing doesn't flash a skeleton every keystroke.
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH || categoryIds.length === 0) { setState({}); return }

    let alive = true
    let controllers: AbortController[] = []
    const timer = setTimeout(() => {
      if (!alive) return
      // Mark every group loading only NOW (debounce settled) so the previous
      // query's results stay on screen for the whole typing window instead of
      // wiping to a loading skeleton on every keystroke.
      setState(Object.fromEntries(categoryIds.map((id) => [id, { results: [], loading: true, error: false }])))
      controllers = categoryIds.map(() => new AbortController())
      categoryIds.forEach((categoryId, i) => {
        fetchCategoryHits(categoryId, q, controllers[i].signal)
          .then(({ hits, error }) => {
            if (!alive) return
            setState((prev) => ({ ...prev, [categoryId]: { results: hits, loading: false, error } }))
          })
      })
    }, DEBOUNCE_MS)

    return () => { alive = false; clearTimeout(timer); controllers.forEach((c) => c.abort()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, query, retryTick])

  // Bump the retry tick to re-fire the same category set/query, e.g. after a fetch error.
  const retry = useCallback(() => setRetryTick((t) => t + 1), [])
  return { groups: state, retry }
}
