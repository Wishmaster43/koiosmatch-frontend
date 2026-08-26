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
 *
 * LOOKUP-I18N-1 (25-08, fix round): `sources` is `{ value, label }[]`, never a
 * bare string[]. A seeded default's LABEL renders in the user's language, but its
 * VALUE stays the exact name the backend sent — that untranslated name is what a
 * picker's onChange emits and what gets POSTed as `candidates.source` /
 * `applications.source`. Flattening this back into one translated string (the old
 * shape) would submit a per-language variant of the same source: `ValidCandidateSource`
 * validates the posted string against the Dutch lookup list (422 for a translated
 * value) and every report grouping on the raw string would split by locale. Every
 * consumer already accepts `Array<string | { value; label }>` (CreatableSelect) or
 * reads `.value`/`.label` directly, so this is a drop-in, not a breaking change.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { lookupNames } from './lookupUtils'

// A picker option: `value` is the untranslated name the backend recognises;
// `label` is what the user sees (translated for a seeded default, unchanged for
// a tenant-typed one). Matches the shared CreatableSelect option shape 1:1.
export interface ApplicationSourceOption { value: string; label: string }

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

// Names keep the seed when empty; apiFreeEntry defaults STRICT when the response omits the flag
// carries no boolean flag (a genuinely empty or failed response), per the reasoning above.
const mapSources = (res: AxiosResponse): SourcesLookupData => {
  const names = lookupNames(res)
  const free = (res?.data as { allow_free_entry?: unknown })?.allow_free_entry
  return {
    sources: names.length ? names : DEFAULT_APPLICATION_SOURCES,
    // Danny 21-08 (settings round): free entry is OFF by default — strict is the
    // norm, free entry is the deliberate exception the tenant switches on themselves.
    apiFreeEntry: typeof free === 'boolean' ? free : false,
  }
}

// Tenant candidate-source lookup with its own free-entry toggle, defaulting to strict when the response omits the flag.
export function useApplicationSources() {
  const { t } = useTranslation('common')
  const { data, invalidate } = useCachedLookup('/candidate-sources', mapSources, FALLBACK)
  // Seeded defaults render in the user language; a tenant value stays as typed
  // (LOOKUP-I18N-1). VALUE stays the raw backend name (never translated) so the
  // submitted `source` is always what the backend's ValidCandidateSource lookup
  // recognises; only LABEL is translated for display.
  const sources = useMemo(
    () => translateSeedList(t, 'candidateSources', data.sources.map(name => ({ value: name, label: name }))),
    [data.sources, t],
  )
  return { sources, allowFreeEntry: data.apiFreeEntry, invalidate }
}
