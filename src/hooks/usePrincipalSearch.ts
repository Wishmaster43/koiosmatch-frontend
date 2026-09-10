/**
 * usePrincipalSearch — the requestId-guarded, server-searched capped (25) list
 * fetch behind a "pick a type, then pick an entity" picker (NoteLinkPicker,
 * tasks/links/AddLinkRow). An empty query sends NEITHER `q` nor `search` — ten
 * of the fourteen task-link endpoints (`ConvertEmptyStringsToNull` turns "" into
 * null, no 'nullable' rule) and four of the five note-link endpoints (customers,
 * customer-locations, departments, contacts) 422 on that null value (contract audit ENT2-01, measured on both surfaces). The
 * requestId guard drops a stale in-flight response so the retry button and a
 * fast type/query change can never let an older page overwrite a newer one.
 * The endpoint config map (which url per type, how to label a row) stays at
 * each consumer — only this fetch mechanic is shared.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import api, { unwrapList } from '@/lib/api'

// `url` is undefined when the caller's own type→endpoint map has no entry for
// the current selection (AddLinkRow's narrowed `types` list) — the fetch then
// clears its rows instead of calling the API.
export function usePrincipalSearch<T>(url: string | undefined, query: string) {
  const [rows, setRows] = useState<T[]>([])
  const [error, setError] = useState(false)
  const requestIdRef = useRef(0)

  // Load a capped, server-searched page for the current url/query — never the whole table.
  const fetchOptions = useCallback(() => {
    if (!url) { setRows([]); return }
    const requestId = ++requestIdRef.current
    setError(false)
    // An empty query must send NEITHER q nor search (ENT2-01, see file header).
    api.get(url, { params: { ...(query ? { q: query, search: query } : {}), per_page: 25 } })
      .then(r => { if (requestIdRef.current === requestId) setRows(unwrapList<T>(r).rows) })
      .catch(() => { if (requestIdRef.current === requestId) setError(true) })
  }, [url, query])
  // Re-runs on url/query change, clearing stale rows first so the previous type's options never flash.
  useEffect(() => { setRows([]); fetchOptions() }, [fetchOptions])

  return { rows, error, fetchOptions }
}
