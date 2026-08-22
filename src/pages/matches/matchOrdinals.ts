/**
 * matchOrdinals — M14/M15 (matches "inzicht" cluster): this match's ordinal
 * position among all of the tenant's matches sharing the same candidate /
 * customer / location / department axis ("3rd match with this candidate",
 * "1st match at this location"). `allRows` is the FULL tenant match set from
 * useMatches (server-paginated internally, safety-capped at 1000 rows — see
 * that hook's own comment), so this client-side count is accurate except in
 * the rare >1000-match tenant edge case. Pure functions, no fetch: the axis ids
 * (candidateId/clientId/customerLocationId/customerDepartmentId) already ride
 * on every list row once mapMatch carries them (see useMatches.ts).
 *
 * MOVED-FROM-OVERVIEW-1 (Danny 22-08, "AKKOORD"): the ordinal footnote used to
 * be the only consumer here; the new Statistieken tab (StatisticsTab) also
 * needs the OTHER matches sharing each axis (not just position/total), so
 * `otherMatchesInAxis` was added — built on the same `sortedAxisGroup` grouping
 * `computeMatchOrdinals` itself now uses, so position/total and the "other
 * matches" list can never disagree about which rows belong to one group.
 */
import type { MatchRow } from '@/types/match'

// One axis result: 1-based position + the group's total size.
export interface MatchOrdinal {
  position: number
  total: number
}

export interface MatchOrdinals {
  candidate: MatchOrdinal | null
  client: MatchOrdinal | null
  location: MatchOrdinal | null
  department: MatchOrdinal | null
}

// Which MatchRow FK field backs each axis — the ONE map every axis-grouping
// helper below reads, so position/total and the "other matches" list can never
// drift onto different fields.
const AXIS_FIELD: Record<keyof MatchOrdinals, keyof MatchRow> = {
  candidate: 'candidateId', client: 'clientId', location: 'customerLocationId', department: 'customerDepartmentId',
}

// All rows sharing `match`'s value for the given axis, sorted oldest-first — the
// one grouping computation every axis helper below builds on. An axis with no id
// on this match (e.g. no location) returns an empty group, never a fake match.
function sortedAxisGroup(allRows: MatchRow[], match: MatchRow, axis: keyof MatchOrdinals): MatchRow[] {
  const key = AXIS_FIELD[axis]
  const id = match[key]
  if (id == null) return []
  return allRows
    .filter(r => r[key] != null && String(r[key]) === String(id))
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
}

// Compute all four axes for one match against the full tenant row set. An axis
// with no id on this match (e.g. no location) is simply null — never a fake "1/1".
export function computeMatchOrdinals(allRows: MatchRow[], match: MatchRow | null): MatchOrdinals {
  if (!match) return { candidate: null, client: null, location: null, department: null }
  const ordinalFor = (axis: keyof MatchOrdinals): MatchOrdinal | null => {
    const group = sortedAxisGroup(allRows, match, axis)
    const idx = group.findIndex(r => String(r.id) === String(match.id))
    return idx === -1 ? null : { position: idx + 1, total: group.length }
  }
  return {
    candidate: ordinalFor('candidate'),
    client: ordinalFor('client'),
    location: ordinalFor('location'),
    department: ordinalFor('department'),
  }
}

// The OTHER matches sharing the given axis with `match` — StatisticsTab's compact
// row list. Same oldest-first order the ordinal position counts by; this match's
// own row is excluded. An axis with no id on this match is simply an empty list
// (never a fake entry).
export function otherMatchesInAxis(allRows: MatchRow[], match: MatchRow | null, axis: keyof MatchOrdinals): MatchRow[] {
  if (!match) return []
  return sortedAxisGroup(allRows, match, axis).filter(r => String(r.id) !== String(match.id))
}
