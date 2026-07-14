/**
 * useKoiosCandidateSearch — live candidate lookup for the "@" composer (Danny
 * 13/7: type a name and get real records to pick from, not just a category).
 * Debounced ~250ms and abort-guarded so fast typing never lets an older, slower
 * response overwrite a newer one. Only searches from 2 typed characters; below
 * that it stays empty without ever hitting the API.
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface KoiosCandidateHit {
  id: string
  name: string
  title: string
  initials: string
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250

// The list row is intentionally light (FRONTEND-CONTRACT §4) — only the fields
// this autocomplete renders.
interface ApiCandidateRow { id?: string | number; name?: string; function_title?: string }

export function useKoiosCandidateSearch(query: string) {
  const [results, setResults] = useState<KoiosCandidateHit[]>([])
  const [loading, setLoading] = useState(false)

  // Debounce + cancel: one AbortController per query, torn down (and any
  // in-flight request aborted) the moment the query changes again or the
  // caller stops searching — a stale reply can never overwrite a newer one.
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH) { setResults([]); setLoading(false); return }

    let alive = true
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      api.get('/candidates', { params: { search: q, per_page: 5 }, signal: controller.signal })
        .then((res) => {
          if (!alive) return
          const rows = unwrapList<ApiCandidateRow>(res).rows
          setResults(rows.map((r) => ({
            id: String(r.id ?? ''),
            name: r.name || '?',
            title: r.function_title || '',
            initials: initialsOf(r.name),
          })))
        })
        .catch(() => { if (alive) setResults([]) })
        .finally(() => { if (alive) setLoading(false) })
    }, DEBOUNCE_MS)

    return () => { alive = false; clearTimeout(timer); controller.abort() }
  }, [query])

  return { results, loading }
}
