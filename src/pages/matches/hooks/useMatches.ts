/**
 * useMatches — loads the tenant's matches (GET /matches) and maps them to the flat
 * MatchRow shape the table renders. A missing endpoint (404) is an empty list, not
 * an error. Data logic lives here so MatchesPage stays presentational (§3).
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { RawMatch, MatchRow } from '@/types/match'

// Map a raw API match → the flat shape the table renders (snake_case-tolerant).
function mapMatch(m: RawMatch): MatchRow {
  const cand = m.candidate ?? {}
  const joined = [cand.first_name, cand.last_name].filter(Boolean).join(' ')
  const name = m.candidate_name ?? cand.name ?? (joined || '—')
  return {
    id:         m.id,
    candidate:  name,
    initials:   name && name !== '—' ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?',
    vacancy:    m.vacancy_title ?? m.vacancy?.title ?? '—',
    client:     m.client_name ?? m.client?.name ?? m.customer?.name ?? '—',
    score:      m.score ?? m.match_score ?? null,
    stage:      m.stage_label ?? m.stage ?? m.status ?? '',
    stageColor: m.stage_color ?? '#6E8FD6',
    owner:      m.owner?.name ?? m.owner_name ?? '',
    date:       m.created_at ?? m.matched_at ?? '',
  }
}

// Match list state: rows (mapped) + loading + error. 404 = empty, not an error.
export function useMatches() {
  const [rows,    setRows]    = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    let alive = true
    api.get('/matches')
      .then(r => { if (alive) setRows((r.data?.data ?? r.data ?? []).map(mapMatch)) })
      .catch(e => { if (alive && e?.response?.status && e.response.status !== 404) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return { rows, loading, error }
}
