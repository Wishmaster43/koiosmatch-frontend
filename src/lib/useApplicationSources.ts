/**
 * useApplicationSources — the searchable/creatable option list for the
 * application "source" field (acquisition channel: Indeed, LinkedIn, referral, …).
 *
 * BACKEND GAP (documented, not faked — see AddApplicationModal's doc comment and
 * the exact ask below): unlike Contractvorm/funnel/phase/functions, there is NO
 * tenant-CRUD lookup endpoint for sources yet (no `/application-sources` route,
 * no `allow_free_entry` flag, no Settings screen). `source` is a genuinely free
 * `sometimes|nullable|string|max:64` column server-side. Building a Settings CRUD
 * screen against a route that does not exist would be a fake affordance (buttons
 * that 404 on save) — so this hook does NOT mirror useFunctions' `/functions` GET.
 *
 * Instead it reuses the ALREADY-REAL vocabulary: `GET /applications/stats` (W27)
 * returns a server-wide `by_source` distribution — the exact same data source the
 * applications page's own source FILTER already aggregates via
 * `applicationInsights.buildSourceDataFromStats`. This hook fetches that endpoint
 * (via the shared useCachedLookup so every mounted picker shares one request) and
 * turns the distinct source names into option strings.
 *
 * `allowFreeEntry` is `true` by default (unlike Functions' strict-by-default):
 * with no tenant lookup to seed itself from, a strict-only picker would let no
 * one add a source until data already existed. It stays a picker (not a bare
 * input) so existing values are reused instead of refragmenting ("Indeed" vs
 * "indeed" vs "Indeed.nl"), which is the whole point of this change — see the
 * Sources report fragmentation problem in the task doc.
 *
 * BACKEND ASK (for when this graduates to a real lookup, mirroring /functions):
 *   - `GET /application-sources` → `{ data: [{ id, name, order, active }], allow_free_entry }`
 *   - `POST/PATCH/DELETE /application-sources/{id}` (CRUD, in-use 409 like every
 *     other candidate/application lookup) + colour + reorder.
 *   - tenant setting `application_sources_allow_free_entry` (mirrors
 *     `functions_allow_free_entry`).
 *   - a one-time backfill: fold every DISTINCT existing `applications.source` value
 *     into the seeded lookup rows so nothing already on a record goes "unknown".
 * Until that ships, this hook (and the pickers built on it) is the honest interim.
 */
import { useCachedLookup } from './useCachedLookup'
import { unwrap } from './api'
import type { AxiosResponse } from 'axios'

// Small starter seed shown before any real /applications/stats data has loaded
// (data values, not UI copy — same treatment as DEFAULT_FUNCTIONS).
export const DEFAULT_APPLICATION_SOURCES = [
  'Indeed', 'LinkedIn', 'Referral', 'Career site', 'Job board', 'Direct approach',
]

// Pull the distinct, non-empty source names out of the stats response's
// `by_source` distribution (same shape applicationInsights.buildSourceDataFromStats reads).
const mapSources = (res: AxiosResponse): string[] => {
  const stats = unwrap<{ by_source?: Array<{ source?: string | null }> }>(res)
  const bySource = stats?.by_source
  const names = Array.isArray(bySource)
    ? Array.from(new Set(bySource.map(s => s.source).filter((s): s is string => Boolean(s))))
    : []
  return names.length ? names : DEFAULT_APPLICATION_SOURCES
}

export function useApplicationSources() {
  const { data } = useCachedLookup('/applications/stats', mapSources, DEFAULT_APPLICATION_SOURCES)
  // No tenant toggle exists yet (see doc comment) — free entry stays on so the
  // picker never blocks recording a source that hasn't been seen before.
  return { sources: data, allowFreeEntry: true }
}
