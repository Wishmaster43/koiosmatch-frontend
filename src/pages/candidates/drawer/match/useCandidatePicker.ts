/**
 * useCandidatePicker — the "+ Match" form's optional candidate search picker
 * (only rendered when the form is opened WITHOUT a fixed candidate, i.e. from
 * the Matches page rather than a candidate's own Match tab). Split out of
 * useMatchForm (§3 size split, over the ~400-line trigger) — a self-contained
 * concern: server-side search debounce, data-minimization (PRIV-1), stale-
 * response guarding (PRIV-2) and the picked-label survival trick
 * (MATCH-PICK-LABEL-1) all live together here.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { Id } from '@/types/common'

interface CandidateOption { id?: Id; name?: string }

// Owns the candidate-picker's own state; returns the resolved candidateId (fixed or picked) plus everything the picker UI needs.
export function useCandidatePicker(fixedCandidateId: Id | undefined) {
  const [pickedCandidateId, setPickedCandidateIdRaw] = useState('')
  const [candidateOptions, setCandidateOptions] = useState<CandidateOption[]>([])
  // MATCH-PICK-LABEL-1: a pick's own label must survive the debounce below —
  // CreatableSelect.pick() resets its typed query to '' right after picking,
  // which (via the onSearch debounce) clears candidateOptions for the too-short
  // query and would otherwise leave the trigger unable to resolve the picked
  // option's label, rendering the raw candidate UUID instead. Captured once, at
  // pick time, from whatever list was showing.
  const [pickedCandidateLabel, setPickedCandidateLabel] = useState<string | undefined>(undefined)
  const setPickedCandidateId = (v: string) => {
    setPickedCandidateLabel(candidateOptions.find(c => String(c.id) === v)?.name)
    setPickedCandidateIdRaw(v)
  }
  // A failed load must not read the same as "no candidates" (R8) — surfaced via candidateOptionsError below.
  const [candidateOptionsError, setCandidateOptionsError] = useState(false)
  // PRIV-1: the picker used to eagerly load 200 full candidate records (incl.
  // special-category data, §8) on every mount with no search term — a data-
  // minimization violation. It now only fetches once the recruiter has typed a
  // real search term, capped to a small page (mirrors useVacancyOptions' own
  // `search` param contract).
  const [candidateSearch, setCandidateSearch] = useState('')
  const CANDIDATE_SEARCH_MIN_CHARS = 2
  // Loads the candidate option list for the picker only when the candidate is not
  // already fixed by the caller AND the recruiter has typed ≥2 chars. PRIV-2: an
  // AbortController + alive guard (§9 "every entity-keyed load effect carries
  // one") so a fast-typed later search can never be overwritten by a slower,
  // now-stale response.
  useEffect(() => {
    if (fixedCandidateId) return
    if (candidateSearch.trim().length < CANDIDATE_SEARCH_MIN_CHARS) { setCandidateOptions([]); setCandidateOptionsError(false); return }
    let alive = true
    const controller = new AbortController()
    setCandidateOptionsError(false)
    // AUDIT: light=1 → GET /candidates returns only id/name/initials (data minimization, §8).
    api.get('/candidates', { params: { per_page: 25, search: candidateSearch.trim(), light: 1 }, signal: controller.signal })
      .then(r => { if (alive) setCandidateOptions((r.data?.data ?? []) as CandidateOption[]) })
      .catch(() => { if (alive) { setCandidateOptions([]); setCandidateOptionsError(true) } })
    return () => { alive = false; controller.abort() }
  }, [fixedCandidateId, candidateSearch])
  const candidateId = fixedCandidateId ?? (pickedCandidateId || '')

  // MATCH-PICK-LABEL-1: re-add the picked candidate to the exposed list whenever
  // the debounced empty-query search has cleared it out from under the trigger
  // (see setPickedCandidateId above) — CreatableSelect resolves its trigger label
  // by finding `value` in `options`, so without this the picked candidate would
  // render as its raw UUID the moment the debounce fires.
  const exposedCandidateOptions = pickedCandidateId && !candidateOptions.some(c => String(c.id) === pickedCandidateId)
    ? [{ id: pickedCandidateId, name: pickedCandidateLabel }, ...candidateOptions]
    : candidateOptions

  return {
    candidateId, pickedCandidateId, setPickedCandidateId,
    candidateOptions: exposedCandidateOptions, candidateOptionsError,
    candidateSearch, setCandidateSearch, CANDIDATE_SEARCH_MIN_CHARS,
  }
}
