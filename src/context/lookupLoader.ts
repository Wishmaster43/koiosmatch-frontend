/**
 * loadTenantLookups — the shared "fetch N tenant lookups in parallel, fall back
 * to the seed per-list on 404/empty/failure" boilerplate behind TaskLookupsContext
 * and VacancyLookupsContext. Both providers ran an identical Promise.allSettled
 * loop around their own differently-shaped normalize() — this factors out just
 * that loop, leaving each provider's own normalize/seed data untouched.
 */
import type { AxiosResponse } from 'axios'
import { unwrap, getActiveTenantId } from '@/lib/api'
import { dedupedGet } from '@/lib/useCachedLookup'

// LOOKUP-RECENT-1: one drawer open mounts the same lookup provider at several sites in
// SEPARATE React ticks (measured 08-10: five TaskLookupsProvider mounts = five rounds of
// three requests even after the in-flight dedupe). A response younger than this window
// is reused by every later mount; a settings edit still shows on the next open, because
// the window is seconds, never a session cache (the freshness rule of this loader).
export const RECENT_LOOKUP_MS = 3000
const recent = new Map<string, { at: number; response: AxiosResponse }>()
// The live window. Under vitest it starts CLOSED (0 ms): a remembered answer would leak
// from one test case into the next and silently change what a sibling suite's api mock
// returns; the suites that test the window open it explicitly with setRecentLookupWindow.
let recentMs = import.meta.env.MODE === 'test' ? 0 : RECENT_LOOKUP_MS

// Test seam: opens (ms > 0) or closes (0) the window for the current test case.
export function setRecentLookupWindow(ms: number): void { recentMs = ms }

// Tenant-scoped slot: a super admin switching bureaus never reads the previous tenant's rows.
const recentKey = (url: string) => `${getActiveTenantId() ?? 'none'}:${url}`

// Test seam: drops every remembered response (the window is module state).
export function clearRecentLookups(): void { recent.clear() }

// The response for a url: the one remembered within the window, else a (deduped) fetch
// whose success is remembered; a failure is never remembered, so the next mount retries.
// Exported for readers of the RAW rows (useTaskLookupIds needs the uuid ids the provider's
// normalize() drops) so they ride the provider's own request instead of firing their own.
export function fetchLookupRecent(url: string): Promise<AxiosResponse> {
  // With the window closed (every vitest suite by default) nothing is remembered and the
  // tenant key is never read — a suite that mocks '@/lib/api' without getActiveTenantId
  // (VacancyDefaultStatusSettings.test, measured 08-10) must keep passing untouched.
  if (recentMs <= 0) return dedupedGet(url)
  const key = recentKey(url)
  const hit = recent.get(key)
  if (hit && Date.now() - hit.at < recentMs) return Promise.resolve(hit.response)
  return dedupedGet(url).then(response => { recent.set(key, { at: Date.now(), response }); return response })
}

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
    // Concurrent provider mounts share one request (dedupedGet) and mounts within the
    // recent window reuse the answer; a later mount still refetches (freshness for
    // settings edits).
    specs.map(({ url, fallback, set, pinId }) =>
      fetchLookupRecent(url)
        .then(r => set(normalize(unwrap(r), fallback, pinId ?? false)))
        .catch(() => { failedUrls.push(url) }),
    ),
  ).finally(() => onDone(failedUrls))
}
