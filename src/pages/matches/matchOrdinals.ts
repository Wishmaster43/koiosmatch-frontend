/**
 * matchOrdinals — M14/M15 (matches "inzicht" cluster): this match's ordinal
 * position among all of the tenant's matches sharing the same candidate /
 * customer / location / department axis ("3rd match with this candidate",
 * "1st match at this location"). `allRows` is the FULL tenant match set from
 * useMatches (server-paginated internally, safety-capped at 1000 rows — see
 * that hook's own comment), so this client-side count is accurate except in
 * the rare >1000-match tenant edge case. Pure function, no fetch: the axis ids
 * (candidateId/clientId/customerLocationId/customerDepartmentId) already ride
 * on every list row once mapMatch carries them (see useMatches.ts).
 */
import type { MatchRow } from '@/types/match'

// One axis result: 1-based position + the group's total size.
export interface MatchOrdinal {
  position: number
  total: number
}

// Locate `matchId` within `rows` after sorting oldest-first, so "1st" means
// "earliest" — the natural reading of "this tenant's 3rd match with them".
function ordinalWithin(rows: MatchRow[], matchId: MatchRow['id']): MatchOrdinal | null {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
  const idx = sorted.findIndex(r => String(r.id) === String(matchId))
  if (idx === -1) return null
  return { position: idx + 1, total: sorted.length }
}

export interface MatchOrdinals {
  candidate: MatchOrdinal | null
  client: MatchOrdinal | null
  location: MatchOrdinal | null
  department: MatchOrdinal | null
}

// Compute all four axes for one match against the full tenant row set. An axis
// with no id on this match (e.g. no location) is simply null — never a fake "1/1".
export function computeMatchOrdinals(allRows: MatchRow[], match: MatchRow | null): MatchOrdinals {
  if (!match) return { candidate: null, client: null, location: null, department: null }
  const byAxis = (id: unknown, key: keyof MatchRow) =>
    id != null ? allRows.filter(r => r[key] != null && String(r[key]) === String(id)) : []
  return {
    candidate:  ordinalWithin(byAxis(match.candidateId, 'candidateId'), match.id),
    client:     ordinalWithin(byAxis(match.clientId, 'clientId'), match.id),
    location:   ordinalWithin(byAxis(match.customerLocationId, 'customerLocationId'), match.id),
    department: ordinalWithin(byAxis(match.customerDepartmentId, 'customerDepartmentId'), match.id),
  }
}
