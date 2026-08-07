/**
 * useCachedLookup — one shared fetch+cache+dedupe path for tenant lookup hooks
 * (useGenders, useFunctions, useNoteTypes, useLastContactTypes, …). Every one of
 * those hooks used to `useState(seed) + useEffect(() => api.get(url)...)` with NO
 * cache: opening a drawer that mounts 5 components using the same hook fired 5
 * identical GETs (audit item 8, 2026-07-15). This hook is the single fix: a
 * module-scope cache keyed by tenant+URL (mirrors useCustomFields's per-entity Map
 * — the strongest existing convention in this codebase) plus a shared in-flight-
 * promise map so concurrent mounts await ONE network call instead of firing one each.
 *
 * `mapFn` receives the raw axios response (same shape every hook already parsed
 * by hand) and returns the mapped value, or `null` to mean "nothing usable in
 * this response — keep the fallback and DON'T cache" (mirrors every hook's old
 * `if (d.length) setX(d)` guard: a genuinely empty/failed response keeps retrying
 * on the next mount instead of freezing the seed forever).
 *
 * Cached for the life of the session/tab (tenant lookups rarely change); call the
 * returned `invalidate()` after a Settings mutation to force the next mount to refetch.
 *
 * TENANT SCOPING: cache/inFlight keys are `${tenantId}:${url}`, not the bare url.
 * A super-admin switching bureaus mid-session must never be served the PREVIOUS
 * tenant's genders/functions/note-types/… from this module-scope cache — the same
 * class of gap fixed on useUsers' React Query key (lib/queries.ts). This is a plain
 * key change, not an abort/cancel of the shared promise cache itself (the PDOK/
 * preflight-cache lesson — never abort a module-scope in-flight promise) — a
 * tenant switch just addresses a DIFFERENT cache slot, it never mutates this one.
 */
import { useEffect, useState } from 'react'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import api, { getActiveTenantId } from './api'

// Shared across every hook built on this helper — keys are `${tenantId}:${url}`,
// unique per lookup per tenant (no two lookup hooks share an endpoint).
const cache = new Map<string, unknown>()
const inFlight = new Map<string, Promise<AxiosResponse>>()

// Reads localStorage fresh on every call (never memoized) so it always reflects
// the CURRENT tenant, mirroring how the axios interceptor derives X-Tenant.
const tenantCacheKey = (url: string) => `${getActiveTenantId() ?? 'none'}:${url}`

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
  const key = tenantCacheKey(url)
  const hit = cache.has(key)
  const [data,    setData]    = useState<T>(hit ? (cache.get(key) as T) : fallback)
  const [loading, setLoading] = useState(!hit)

  // Fetch once per tenant+URL, ever (until invalidate()); de-dupe concurrent mounts
  // onto one in-flight request. `mapFn`/`requestConfig` are treated as stable per
  // hook definition (module-level functions/literals) — only `url` re-triggers a
  // fetch (the key is recomputed from the CURRENT tenant on every run, so a tenant
  // switch — which reloads the app per AuthContext — always resolves fresh anyway).
  useEffect(() => {
    const cacheKey = tenantCacheKey(url)
    if (cache.has(cacheKey)) { setData(cache.get(cacheKey) as T); setLoading(false); return }

    let request = inFlight.get(cacheKey)
    if (!request) {
      request = api.get(url, requestConfig)
      inFlight.set(cacheKey, request)
      // Settle-cleanup runs once (not per mount). The trailing .catch swallows THIS
      // chain's rejection — the real error is handled per-consumer at the .catch below;
      // without it a failed lookup fetch surfaced as an unhandled promise rejection.
      request.finally(() => inFlight.delete(cacheKey)).catch(() => {})
    }

    let alive = true
    request
      .then(res => {
        const mapped = mapFn(res)
        if (mapped !== null) {
          cache.set(cacheKey, mapped)
          if (alive) setData(mapped)
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapFn/requestConfig are stable per call site; only `url` should re-trigger.
  }, [url])

  const invalidate = () => cache.delete(tenantCacheKey(url))
  return { data, loading, invalidate }
}
