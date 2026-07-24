/**
 * smCandidateFilters — pure client-side refine helpers for the SM candidates table
 * (§0.3 size split from CandidatesDetailPage). useSmCandidatesList has no server-side
 * search/status param yet, so both filters apply only to the CURRENTLY LOADED page
 * (a pre-existing limitation carried over from the old reports/CandidatesTable —
 * a true cross-page filter needs a backend query param).
 */
import type { ReportCandidate } from '@/types/reports'

// True when the candidate's status matches one of the selected values (case-insensitive,
// mirrors CandidatesKpiRow's count() predicate). An empty filter matches everything.
export function matchesStatus(c: ReportCandidate, statusFilter: Array<string | number>): boolean {
  if (!statusFilter.length) return true
  return statusFilter.map(v => String(v).toLowerCase()).includes((c.status ?? '').toLowerCase())
}

// True when name/email/position/mobile/phone contains the (trimmed, lowercased) query.
export function matchesSearch(c: ReportCandidate, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [c.firstname, c.lastname, c.email, c.position, c.mobile, c.phone].join(' ').toLowerCase()
  return hay.includes(q)
}

// Combined refine — status AND free-text search over one page of rows.
export function filterSmCandidates(
  candidates: ReportCandidate[],
  statusFilter: Array<string | number>,
  search: string,
): ReportCandidate[] {
  return candidates.filter(c => matchesStatus(c, statusFilter) && matchesSearch(c, search))
}
