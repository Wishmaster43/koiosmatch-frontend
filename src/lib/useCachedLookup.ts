/**
 * useCachedLookup — one shared fetch+cache+dedupe path for tenant lookup hooks
 * (useGenders, useFunctions, useNoteTypes, useLastContactTypes, …). Every one of
 * those hooks used to `useState(seed) + useEffect(() => api.get(url)...)` with NO
 * cache: opening a drawer that mounts 5 components using the same hook fired 5
 * identical GETs (audit item 8, 2026-07-15). This hook is the single fix: a
 * module-scope cache keyed by URL (mirrors useCustomFields's per-entity Map — the
 * strongest existing convention in this codebase) plus a shared in-flight-promise
 * map so concurrent mounts await ONE network call instead of firing one each.
 *
 * `mapFn` receives the raw axios response (same shape every hook already parsed
 * by hand) and returns the mapped value, or `null` to mean "nothing usable in
 * this response — keep the fallback and DON'T cache" (mirrors every hook's old
 * `if (d.length) setX(d)` guard: a genuinely empty/failed response keeps retrying
 * on the next mount instead of freezing the seed forever).
 *
 * Cached for the life of the session/tab (tenant lookups rarely change); call the
 * returned `invalidate()` after a Settings mutation to force the next mount to refetch.
 */
import { useEffect, useState } from 'react'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import api from './api'

// Shared across every hook built on this helper — keys are request URLs, which
// are unique per lookup (no two lookup hooks share an endpoint).
const cache = new Map<string, unknown>()
const inFlight = new Map<string, Promise<AxiosResponse>>()

export interface CachedLookupResult<T> {
  data: T
  loading: boolean
  invalidate: () => void
}

export function useCachedLookup<T>(
  url: string,
  mapFn: (res: AxiosResponse) => T | null,
  fallback: T,
  requestConfig?: AxiosRequestConfig,
): CachedLookupResult<T> {
  const hit = cache.has(url)
  const [data,    setData]    = useState<T>(hit ? (cache.get(url) as T) : fallback)
  const [loading, setLoading] = useState(!hit)

  // Fetch once per URL, ever (until invalidate()); de-dupe concurrent mounts onto
  // one in-flight request. `mapFn`/`requestConfig` are treated as stable per hook
  // definition (module-level functions/literals) — only `url` re-triggers a fetch.
  useEffect(() => {
    if (cache.has(url)) { setData(cache.get(url) as T); setLoading(false); return }

    let request = inFlight.get(url)
    if (!request) {
      request = api.get(url, requestConfig)
      inFlight.set(url, request)
      // Settle-cleanup runs once (not per mount). The trailing .catch swallows THIS
      // chain's rejection — the real error is handled per-consumer at the .catch below;
      // without it a failed lookup fetch surfaced as an unhandled promise rejection.
      request.finally(() => inFlight.delete(url)).catch(() => {})
    }

    let alive = true
    request
      .then(res => {
        const mapped = mapFn(res)
        if (mapped !== null) {
          cache.set(url, mapped)
          if (alive) setData(mapped)
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapFn/requestConfig are stable per call site; only `url` should re-trigger.
  }, [url])

  const invalidate = () => cache.delete(url)
  return { data, loading, invalidate }
}
