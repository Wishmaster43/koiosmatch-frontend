/**
 * archiveGuard — pure API helpers for the archive/trash interception (§3B: a
 * candidate must never move to Gearchiveerd/Prullenbak while a LIVE application
 * or ACTIVE match still hangs on it). Kept out of the hooks/component so both
 * the single-record drawer flow and the bulk-archive flow share one source of
 * truth (§0.3). Field names below are MEASURED against the real dev API
 * (2026-07-13 probe), not guessed:
 *   - GET /candidates/{id} → data.applications[] is only { id, vacancyTitle,
 *     stageLabel, stageColor } — no funnel SLUG, so liveness needs a per-item
 *     GET /applications/{id} (→ phase_key) to judge hired/rejected vs live.
 *   - GET /candidates/{id} → data.matches[] carries a real slug: status
 *     'open' | 'closed' (confirmed via /matches PATCH's documented enum).
 */
import api from '@/lib/api'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// A blocking application, ready for the modal (already filtered to "live").
export interface BlockingApplication {
  id: Id
  vacancyTitle: string
  stageLabel: string
  stageColor: string | null
  candidateName?: string
}
// A blocking (open) match, ready for the modal.
export interface BlockingMatch {
  id: Id
  vacancyTitle: string
  client: string
  statusKey: string
  candidateName?: string
}
export interface LiveBlockers { applications: BlockingApplication[]; matches: BlockingMatch[] }

// Cheap ROW-level pre-filter (no network call): a funnel chip that isn't
// terminal, or a "Placed" deployability (which the model requires a linked
// Match for), flags a candidate as worth the full live-blockers check. Rows
// with neither signal skip straight to archiving (the 409 catch is the safety
// net if this heuristic ever misses a live link).
export const needsLiveCheck = (c?: Candidate | null): boolean =>
  !!c && ((!!c.stage && c.stage !== 'hired' && c.stage !== 'rejected') || c.status === 'placed')

// The nested application ref lacks a funnel slug — resolve the authoritative
// phase_key per id (bounded: a candidate rarely holds more than a handful).
const isLiveApplication = async (id: Id): Promise<boolean> => {
  try {
    const r = await api.get(`/applications/${id}`)
    const key = (r.data?.data ?? r.data)?.phase_key
    return !!key && key !== 'hired' && key !== 'rejected'
  } catch {
    // Unreadable application (deleted/404 mid-flight) — don't block on it.
    return false
  }
}

// The one full check: GET the candidate detail, then resolve which nested
// applications are still live and which matches are still open.
export async function fetchLiveBlockers(id: Id): Promise<LiveBlockers> {
  const r = await api.get(`/candidates/${id}`)
  const data = (r.data?.data ?? r.data ?? {}) as {
    applications?: Array<{ id: Id; vacancyTitle?: string | null; stageLabel?: string | null; stageColor?: string | null }>
    matches?: Array<{ id: Id; vacancy?: { title?: string } | null; client?: string; customer?: { name?: string }; status?: string }>
  }
  const rawApps = data.applications ?? []
  const rawMatches = data.matches ?? []

  const liveFlags = await Promise.all(rawApps.map(a => isLiveApplication(a.id)))
  const applications: BlockingApplication[] = rawApps
    .filter((_, i) => liveFlags[i])
    .map(a => ({ id: a.id, vacancyTitle: a.vacancyTitle || '—', stageLabel: a.stageLabel || '—', stageColor: a.stageColor ?? null }))

  const matches: BlockingMatch[] = rawMatches
    .filter(m => m.status === 'open')
    .map(m => ({ id: m.id, vacancyTitle: m.vacancy?.title || '—', client: m.client ?? m.customer?.name ?? '', statusKey: m.status ?? 'open' }))

  return { applications, matches }
}

// Normalise the backend's forward-compat 409 guard payload
// ({ live: { applications, matches } }) into the same modal shape. The backend
// has ALREADY filtered to live-only here, so no per-application re-check needed.
export function normalizeLivePayload(live: unknown): LiveBlockers {
  const v = (live ?? {}) as { applications?: unknown[]; matches?: unknown[] }
  const applications: BlockingApplication[] = (v.applications ?? []).map((raw) => {
    const a = raw as { id: Id; vacancyTitle?: string | null; vacancy_title?: string | null; stageLabel?: string | null; phase_label?: string | null; stageColor?: string | null; phase_color?: string | null }
    return { id: a.id, vacancyTitle: a.vacancyTitle || a.vacancy_title || '—', stageLabel: a.stageLabel || a.phase_label || '—', stageColor: a.stageColor ?? a.phase_color ?? null }
  })
  const matches: BlockingMatch[] = (v.matches ?? []).map((raw) => {
    const m = raw as { id: Id; vacancy?: { title?: string }; vacancyTitle?: string; client?: string; customer?: { name?: string }; status?: string }
    return { id: m.id, vacancyTitle: m.vacancy?.title || m.vacancyTitle || '—', client: m.client ?? m.customer?.name ?? '', statusKey: m.status ?? 'open' }
  })
  return { applications, matches }
}

// Read the `{ live: {...} }` guard payload off a 409 error, if present.
export function liveFromError(e: unknown): LiveBlockers | null {
  const resp = (e as { response?: { status?: number; data?: { live?: unknown } } })?.response
  if (resp?.status !== 409 || !resp.data?.live) return null
  const live = normalizeLivePayload(resp.data.live)
  return (live.applications.length || live.matches.length) ? live : null
}

// Resolve ONE blocking application: PATCH it to the 'rejected' funnel stage —
// mirrors ApplicationsPage.handleMove's own phase-move call (same endpoint/body).
export async function resolveApplication(id: Id): Promise<boolean> {
  try { await api.patch(`/applications/${id}`, { phase_key: 'rejected' }); return true }
  catch { return false }
}

// Resolve ONE blocking match: soft-delete it. A 409 means an active HelloFlex
// contract still hangs on it — kept blocking, surfaced inline (§10: never orphan).
export async function resolveMatch(id: Id): Promise<{ ok: boolean; conflict: boolean }> {
  try { await api.delete(`/matches/${id}`); return { ok: true, conflict: false } }
  catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    return { ok: false, conflict: status === 409 }
  }
}
