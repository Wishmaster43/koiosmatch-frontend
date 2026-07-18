/**
 * useMatches — loads the tenant's matches (GET /matches) and maps them to the flat
 * MatchRow shape the table renders. A missing endpoint (404) is an empty list, not
 * an error. Data logic lives here so MatchesPage stays presentational (§3).
 *
 * ARCHIVE-1 (2026-07-18): this used to accept an `includeArchived` flag and send
 * `?include_archived=1`, mirroring vacancies/applications/opportunities — but
 * MatchController::index never reads that param (no `withTrashed()` on the query,
 * grepped app/Http/Controllers/MatchController.php) and neither MatchListResource
 * nor MatchDetailResource ever serialize `archived`/`deleted_at`. The flag was a
 * no-op: toggling it re-fetched the identical rows every time. Dropped rather than
 * shipped as a fake control (§0/§4) — re-add once the backend adds `include_archived`
 * handling + the archived/deleted_at fields (mirror OpportunityController@index +
 * VacancyListResource/ApplicationListResource).
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import type { RawMatch, MatchRow } from '@/types/match'

// Map a raw API match → the flat shape the table renders (snake_case-tolerant).
function mapMatch(m: RawMatch): MatchRow {
  const cand = m.candidate ?? {}
  const joined = [cand.first_name, cand.last_name].filter(Boolean).join(' ')
  const name = m.candidate_name ?? cand.name ?? (joined || '—')
  return {
    id:         m.id,
    // NUMMER-1: human-readable reference number (M-00042).
    referenceNumber: m.reference_number ?? '',
    candidate:  name,
    initials:   name && name !== '—' ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?',
    vacancy:    m.vacancy_title ?? m.vacancy?.title ?? '—',
    client:     m.client_name ?? m.client?.name ?? m.customer?.name ?? '—',
    // Flat FKs (§3A cross-entity links) — the Relations tab hyperlinks candidate/
    // vacancy/klant to their own page via these (EntityLink degrades to plain text
    // when null, so an absent id never renders a dead link).
    candidateId: m.candidate_id ?? m.candidate?.id ?? null,
    vacancyId:   m.vacancy_id ?? m.vacancy?.id ?? null,
    clientId:    m.customer_id ?? m.client?.id ?? m.customer?.id ?? null,
    score:      m.score ?? m.match_score ?? null,
    // Funnel stage only — the old `?? m.status` fallback painted "open" into the
    // stage axis once the R-1b resource replaced stage with status (broken board).
    stage:      m.stage_label ?? m.stage ?? '',
    status:     m.status ?? '',
    stageColor: m.stage_color ?? '#6E8FD6',
    owner:      m.owner?.name ?? m.owner_name ?? '',
    // Owner avatar (§3A) — the resource already carries avatar_color; only the
    // mapper was dropping it (Danny 2026-07-14 table standardization).
    ownerInitials: initialsOf(m.owner?.name ?? m.owner_name),
    ownerColor:    m.owner?.avatar_color ?? null,
    date:       m.created_at ?? m.matched_at ?? '',
    // Approval workflow (MATCH-APPROVAL-1) — the list carries the status; the
    // rejection reason is detail-only (useMatchApproval fetches it lazily).
    approval_status:          m.approval_status ?? '',
    approval_rejected_reason: m.approval_rejected_reason ?? '',
    // Tenant custom-field values (§3B "Eigen velden").
    customFieldValues: m.custom_fields ?? {},
  }
}

// Match list state: rows (mapped) + loading + error. 404 = empty, not an error.
// `ref` (NUMMER-1): an exact case-insensitive reference-number lookup (M-00042) —
// when set, the super-search on the page detected a reference query, so this
// fetches a single filtered page instead of the full paginated set.
export function useMatches(ref: string | null = null) {
  const [rows,    setRows]    = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  // Bumping the tick re-runs the fetch — used after creating a placement (the
  // server derives stage/status/rate fields, so a refetch beats hand-mapping) and
  // after an archive/restore (useMatchArchive) so a just-archived row drops out of
  // the list and a just-restored one comes back.
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    // Fetch the FULL set: the default 25-row page made every KPI/board undercount
    // (Danny: "84 vs 25" — 25 wás de bug). per_page is server-capped at 100 (422
    // above it), so follow last_page and accumulate; safety cap at 10 pages.
    const base: Record<string, unknown> = { per_page: 100 }
    const loadAll = async () => {
      // A reference-number query (NUMMER-1) is an exact server-side lookup — one
      // request, no pagination loop; the server ignores other filters when `ref` is set.
      if (ref) {
        const r = await api.get('/matches', { params: { ref } })
        return (r.data?.data ?? []) as RawMatch[]
      }
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
  }, [refreshTick, ref])

  // Patch one match in place (optimistic board drag / stage change / archive flag).
  const updateMatch = (id: MatchRow['id'], patch: Partial<MatchRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))

  const reload = () => setRefreshTick(t => t + 1)

  return { rows, loading, error, updateMatch, reload }
}
