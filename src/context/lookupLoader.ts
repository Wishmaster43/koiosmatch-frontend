/**
 * loadTenantLookups — the shared "fetch N tenant lookups in parallel, fall back
 * to the seed per-list on 404/empty/failure" boilerplate behind TaskLookupsContext
 * and VacancyLookupsContext. Both providers ran an identical Promise.allSettled
 * loop around their own differently-shaped normalize() — this factors out just
 * that loop, leaving each provider's own normalize/seed data untouched.
 */
import { unwrap } from '@/lib/api'
import { dedupedGet } from '@/lib/useCachedLookup'

// One lookup fetch: its URL, its seed fallback, its setter, and (channels only) the pinId flag.
export interface LookupLoadSpec<T> {
  url: string
  fallback: T
  set: (v: T) => void
  pinId?: boolean
}

// Fetches every spec in parallel; a failed/empty response keeps that list's own seed fallback (never breaks the others).
// onDone receives the URLs that failed (empty when everything loaded) so a consumer CAN surface "showing defaults" instead
// of silently rendering the seed with loading:false — existing callers with a zero-arg onDone stay compatible (D8).
export function loadTenantLookups<T>(
  specs: LookupLoadSpec<T>[],
  normalize: (raw: unknown, fallback: T, pinId: boolean) => T,
  onDone: (failedUrls: string[]) => void,
): void {
  const failedUrls: string[] = []
  Promise.allSettled(
    // Concurrent provider mounts share one request; a later mount still refetches
    // (freshness for settings edits) — dedupedGet only de-dupes IN-FLIGHT calls.
    specs.map(({ url, fallback, set, pinId }) =>
      dedupedGet(url)
        .then(r => set(normalize(unwrap(r), fallback, pinId ?? false)))
        .catch(() => { failedUrls.push(url) }),
    ),
  ).finally(() => onDone(failedUrls))
}
