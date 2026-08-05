/**
 * useBusinessEmailDuplicateCheck (BUSINESS-EMAIL-DUP-1, Danny 05-08 point 1.1.5) —
 * warns, never blocks, when a ZZP business e-mail typed on SAVE already belongs to
 * another candidate.
 *
 * Reuses the EXISTING `GET /candidates?search=` list endpoint — the same one the
 * main candidate search box already sends free text through (useCandidateFilters) —
 * rather than the dedicated `GET /candidates/check-duplicate` probe: that probe was
 * built and reverted the same day (see addmodal/useDuplicateProbe.ts) because firing
 * it on every keystroke wrote e-mail/mobile straight into query strings on every
 * keypress (§7 — PII never in a query string/log). This check fires ONCE, on save,
 * never per keystroke — the caller is expected to gate that (ZzpTab only calls this
 * when the typed value differs from what was last saved).
 *
 * NOTE (report this to CMFE/backend-Claude): `search` only matches the CANDIDATE's
 * own `email`/`phone`/name columns server-side (CandidateQuery::applyCandidateFilters)
 * — it does NOT index another candidate's own `business_email` (that lives on the
 * separate `candidate_freelance_profiles` table, untouched by the search scope). So
 * this check catches "this address already belongs to someone's personal contact
 * info" but will miss two freelancers sharing one business e-mail until the backend
 * search indexes that column too.
 *
 * Best-effort: a failed probe (network/permission) never blocks the save.
 */
import { useRef } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'
import type { DuplicateMatch } from '../addmodal/useDuplicateProbe'

// The list resource's minimal shape this probe reads — id + display name + archived
// state (never more: §8 data minimisation, mirrors DuplicateMatch itself).
interface CandidateHit { id: Id; name?: string | null; archived?: boolean }

export function useBusinessEmailDuplicateCheck(excludeId: Id) {
  // Guards a double-click of Save from firing two overlapping probes.
  const inFlight = useRef(false)

  // Search for the typed e-mail; the first hit that ISN'T this candidate itself
  // is the duplicate signal (no `exclude` param exists on the backend, so the
  // current record is filtered out client-side).
  const checkDuplicate = async (email: string): Promise<DuplicateMatch | null> => {
    if (inFlight.current) return null
    inFlight.current = true
    try {
      const res = await api.get('/candidates', { params: { search: email, per_page: 5 } })
      const rows = unwrapList<CandidateHit>(res).rows
      const hit = rows.find(r => String(r.id) !== String(excludeId))
      return hit ? { id: hit.id, name: hit.name ?? null, archived: hit.archived } : null
    } catch {
      return null
    } finally {
      inFlight.current = false
    }
  }

  return { checkDuplicate }
}
