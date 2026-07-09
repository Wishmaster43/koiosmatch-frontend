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
    // Funnel stage only — the old `?? m.status` fallback painted "open" into the
    // stage axis once the R-1b resource replaced stage with status (broken board).
    stage:      m.stage_label ?? m.stage ?? '',
    status:     m.status ?? '',
    stageColor: m.stage_color ?? '#6E8FD6',
    owner:      m.owner?.name ?? m.owner_name ?? '',
    date:       m.created_at ?? m.matched_at ?? '',
    // Approval workflow (MATCH-APPROVAL-1) — the list carries the status; the
    // rejection reason is detail-only (useMatchApproval fetches it lazily).
    approval_status:          m.approval_status ?? '',
    approval_rejected_reason: m.approval_rejected_reason ?? '',
  }
}

// Match list state: rows (mapped) + loading + error. 404 = empty, not an error.
export function useMatches(includeArchived = false) {
  const [rows,    setRows]    = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // Archived view asks the API for soft-deleted matches too (`?include_archived=1`);
  // off by default so KPI totals drop and erased data stays hidden (§3B, AVG).
  useEffect(() => {
    let alive = true
    setLoading(true)
    // Fetch the FULL set: the default 25-row page made every KPI/board undercount
    // (Danny: "84 vs 25" — 25 wás de bug). per_page is server-capped at 100 (422
    // above it), so follow last_page and accumulate; safety cap at 10 pages.
    const base: Record<string, unknown> = { per_page: 100 }
    if (includeArchived) base.include_archived = 1
    const loadAll = async () => {
      const all: RawMatch[] = []
      for (let pageNo = 1; pageNo <= 10; pageNo++) {
        const r = await api.get('/matches', { params: { ...base, page: pageNo } })
        all.push(...(r.data?.data ?? []))
        const last = r.data?.meta?.last_page ?? 1
        if (pageNo >= last) break
      }
      return all
    }
    loadAll()
      .then(raw => { if (alive) setRows(raw.map(mapMatch)) })
      .catch(e => { if (alive && e?.response?.status && e.response.status !== 404) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [includeArchived])

  // Prepend a newly-created match so it shows immediately (optimistic; §3).
  const addMatch = (row: MatchRow) => setRows(prev => [row, ...prev])

  // Patch one match in place (optimistic board drag / stage change).
  const updateMatch = (id: MatchRow['id'], patch: Partial<MatchRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))

  return { rows, loading, error, addMatch, updateMatch }
}
