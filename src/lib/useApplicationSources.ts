/**
 * useApplicationSources — the searchable/creatable option list for the
 * application "source" field (acquisition channel: Indeed, LinkedIn, referral, …).
 *
 * S-SOURCE-1 GRADUATION (2026-08-14): the backend has delivered the tenant-CRUD
 * lookup this hook's doc comment used to ask for — `GET /candidate-sources`
 * (CandidateSourceController, on the shared FreeEntryLookupController base that
 * also backs /functions and /contact-functions: CRUD + reorder + in-use 409 +
 * a free-entry toggle). It is named "candidate-sources" and, per the backend's
 * own doc comment, feeds BOTH the candidate intake source field AND this
 * application source picker — one shared vocabulary, two consumers. An idempotent
 * backfill folded every DISTINCT free-text `candidates.source` / `applications.source`
 * value that existed before this lookup shipped into it, so nothing already on a
 * record went "unknown".
 *
 * IMPORTANT: `candidates.source` / `applications.source` themselves are UNCHANGED —
 * still plain strings matched by NAME, never a foreign key (CandidateSource is a
 * validated SUGGESTION set, not a hard relation; the "none" sentinel and every
 * report shape built on the raw string keep working). This hook mirrors that: it
 * returns option NAMES, not ids, exactly like useFunctions/useContactFunctions.
 *
 * `allowFreeEntry` is read straight off THIS SAME response's `allow_free_entry`
 * flag — deliberately NOT shadowed through a second tenant-settings-blob key the
 * way useFunctions/useContactFunctions do (`getBoolSetting(settings,
 * '..._allow_free_entry', ...)`). That shadow key is a DIFFERENT Setting row than
 * the one the backend actually enforces: both `ValidCandidateSource` (the request
 * rule gating POST/PATCH `source`) and `FreeEntryLookupController::allowFreeEntry()`
 * read the DOTTED `candidate_sources.allow_free_entry` key, written only by
 * `PUT /candidate-sources/free-entry` — the generic `POST /settings` blob
 * (underscored keys) never reaches it. Wiring a second, disconnected key here
 * would reproduce that exact gap (a toggle that reads as "on" in this app while
 * the server still 422s a newly typed value with "The selected bron is not in
 * the configured list") — see ApplicationSourcesSettings.jsx, which persists
 * through the real dedicated route so this single response stays authoritative.
 *
 * Fetch/cache/dedupe via the shared useCachedLookup (one GET per session, shared
 * across every mounted picker). `invalidate` is exposed so the settings screen can
 * force a refetch right after changing the free-entry flag. A value recorded
 * before this lookup existed (or typed off-list while free entry was on) still
 * renders on its record even once free entry is off again — the picker
 * (CreatableSelect) always falls back to showing the raw stored value when it
 * isn't one of the listed options, so nothing is ever silently dropped.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

// Small starter seed shown before any real /candidate-sources data has loaded
// (data values, not UI copy — same treatment as DEFAULT_FUNCTIONS).
export const DEFAULT_APPLICATION_SOURCES = [
  'Indeed', 'LinkedIn', 'Referral', 'Career site', 'Job board', 'Direct approach',
]

// Both pieces of state (names + the API's free-entry flag) come from the same
// response, so they're cached together as one value.
//
// FREE-ENTRY-FALLBACK-1: the pending/unknown value is PERMISSIVE, not strict, and
// that direction is deliberate. Strict-while-unknown means "no value is valid",
// which locks a recruiter out of a required field for a reason they cannot see:
// before the lookup has loaded, when the request fails, or on a fresh tenant whose
// list is still empty. The backend hit exactly this on 15-08 — its own rule
// inherited a strict default against an empty table, so "strict" meant "every
// source is invalid" and four write paths answered 422 where free text had always
// been accepted. It now defaults to permissive too, so this mirrors the real
// contract rather than guessing the safer-sounding option. Being briefly too
// permissive costs a value the server can still reject; being briefly too strict
// costs the user the ability to work at all.
interface SourcesLookupData { sources: string[]; apiFreeEntry: boolean }
const FALLBACK: SourcesLookupData = { sources: DEFAULT_APPLICATION_SOURCES, apiFreeEntry: true }

// Names keep the seed when empty; apiFreeEntry stays permissive when the response
// carries no boolean flag (a genuinely empty or failed response), per the reasoning above.
const mapSources = (res: AxiosResponse): SourcesLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    sources: names.length ? names : DEFAULT_APPLICATION_SOURCES,
    apiFreeEntry: typeof free === 'boolean' ? free : true,
  }
}

export function useApplicationSources() {
  const { data, invalidate } = useCachedLookup('/candidate-sources', mapSources, FALLBACK)
  return { sources: data.sources, allowFreeEntry: data.apiFreeEntry, invalidate }
}
