/**
 * useSearchOptions — one entity's server-searched picker options (§0.3 split
 * out of AddApplicationModal, mirrors the candidate addmodal/ folder). Re-fetches
 * on every search-box edit instead of a single 100-row mount fetch (mirrors
 * tasks/drawer/LinksTab's identical candidate/vacancy/… picker fetch). A
 * `requestId` freshness guard (this idiom, not an AbortController) drops a
 * superseded response instead of letting a slow earlier query overwrite a
 * faster later one (§9 alive-guard). `skip` short-circuits entirely for the
 * locked-vacancy path (data minimisation, §8/§9).
 */
import { useState, useEffect, useRef } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { PickOption, RawPickRow } from './types'

// W30: the candidate/vacancy page size per server search round-trip — mirrors the
// backend's own default (CandidateProfileController::index / VacancyController::index
// both default per_page to 25); typing narrows the ACTUAL tenant table via `search`
// instead of ever pulling the first 100 rows and filtering that stale local slice.
const SEARCH_PAGE_SIZE = 25

export function useSearchOptions(url: string, mapRow: (row: RawPickRow) => PickOption, skip: boolean) {
  const [query, setQuery]           = useState('')
  const [options, setOptions]       = useState<PickOption[]>([])
  const [error, setError]           = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const requestIdRef = useRef(0)
  useEffect(() => {
    if (skip) return
    const requestId = ++requestIdRef.current
    setError(false)
    api.get(url, { params: { search: query, per_page: SEARCH_PAGE_SIZE } })
      .then(r => { if (requestIdRef.current === requestId) setOptions(unwrapList<RawPickRow>(r).rows.map(mapRow)) })
      .catch(() => { if (requestIdRef.current === requestId) setError(true) })
  }, [url, query, skip, mapRow, reloadTick])
  return { query, setQuery, options, error, retry: () => setReloadTick(t => t + 1) }
}
