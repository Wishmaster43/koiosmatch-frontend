/**
 * useSearchOptions — one entity's server-searched picker options (§0.3 split
 * out of AddApplicationModal, mirrors the candidate addmodal/ folder). Re-fetches
 * on every search-box edit instead of a single 100-row mount fetch (mirrors
 * tasks/drawer/LinksTab's identical candidate/vacancy/… picker fetch). A
 * `requestId` freshness guard (this idiom, not an AbortController) drops a
 * superseded response instead of letting a slow earlier query overwrite a
 * faster later one (§9 alive-guard). `skip` short-circuits entirely for the
 * locked-vacancy path (data minimisation, §8/§9).
 *
 * FIX 2 (P1, measured 08-08): a failed search used to collapse into ONE generic
 * boolean ("search failed"), so a genuine 403 (no permission), a 422, a real 5xx
 * and a dropped connection all read identically to the recruiter — none of them
 * actionable. `error` is now classified into a `SearchErrorKind` so
 * SearchPickField can say WHY and the retry affordance still applies to every
 * kind (a transient network blip and a flaky 5xx are both worth retrying).
 * extractApiError doesn't fit here on purpose: this hook never renders the raw
 * server message for a background picker search (§8 minimisation — an
 * unreviewed backend string surfacing straight into a live-typing dropdown is
 * exactly the kind of leak that helper exists to centralise, not bypass), so the
 * classification stays fixed, honest, per-kind copy instead.
 */
import { useState, useEffect, useRef } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { PickOption, RawPickRow, SearchErrorKind } from './types'

// W30: the candidate/vacancy page size per server search round-trip — mirrors the
// backend's own default (CandidateProfileController::index / VacancyController::index
// both default per_page to 25); typing narrows the ACTUAL tenant table via `search`
// instead of ever pulling the first 100 rows and filtering that stale local slice.
const SEARCH_PAGE_SIZE = 25

// Classify an axios rejection into the bucket the recruiter actually needs to
// know about: no `response` at all means the request never completed (network/
// timeout/CORS) rather than the server rejecting it.
function classifySearchError(err: unknown): SearchErrorKind {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === undefined) return 'network'
  if (status === 401 || status === 403) return 'forbidden'
  if (status === 422) return 'validation'
  if (status >= 500) return 'server'
  return 'unknown'
}

// Server-searched picker options for one entity: re-fetches per keystroke, guarded against out-of-order responses, and skips entirely when the caller's context is already locked.
export function useSearchOptions(url: string, mapRow: (row: RawPickRow) => PickOption, skip: boolean) {
  const [query, setQuery]           = useState('')
  const [options, setOptions]       = useState<PickOption[]>([])
  const [error, setError]           = useState<SearchErrorKind | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const requestIdRef = useRef(0)
  // Re-runs the search on every query/skip/retry change; requestId drops a superseded response instead of letting a slow earlier query overwrite a faster later one.
  useEffect(() => {
    if (skip) return
    const requestId = ++requestIdRef.current
    setError(null)
    // EMPTY-SEARCH-422 (Danny live 08-08, "add.searchErrorValidation" on screen):
    // the picker opens with an empty box, and sending `search=''` made Laravel's
    // ConvertEmptyStringsToNull turn it into null, which the (non-nullable) rule
    // then rejected — so EVERY open showed a validation error before typing.
    // An empty search is meaningless anyway: omit the param and ask for the plain
    // first page. (CMBE is adding `nullable` server-side too; this stays correct
    // either way.)
    const trimmed = query.trim()
    const params = trimmed ? { search: trimmed, per_page: SEARCH_PAGE_SIZE } : { per_page: SEARCH_PAGE_SIZE }
    api.get(url, { params })
      .then(r => { if (requestIdRef.current === requestId) setOptions(unwrapList<RawPickRow>(r).rows.map(mapRow)) })
      .catch(err => { if (requestIdRef.current === requestId) setError(classifySearchError(err)) })
  }, [url, query, skip, mapRow, reloadTick])
  return { query, setQuery, options, error, retry: () => setReloadTick(t => t + 1) }
}
