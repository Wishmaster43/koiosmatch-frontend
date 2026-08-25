/**
 * opportunityOrdinals — this opportunity's ordinal position among the tenant's
 * OTHER opportunities at the same customer ("2nd opportunity with this
 * client"), plus the peer list itself, for the drawer's Statistieken tab
 * (mirrors matches/matchOrdinals.ts, scoped to the single customer axis this
 * entity has — no candidate/location/department equivalent exists here).
 * `allRows` is the full tenant opportunity set (useOpportunitiesData's `rows`,
 * already fetch-all looped — see that hook's own comment), so this client-side
 * count is accurate for the same reason matches' own ordinal is.
 */
import type { Opportunity } from '@/types/opportunity'

// One axis result: 1-based position + the group's total size (mirrors matchOrdinals.ts).
export interface OpportunityOrdinal {
  position: number
  total: number
}

// All rows sharing this opportunity's customer, sorted oldest-first — the one
// grouping computation both helpers below build on. No clientId on this deal
// returns an empty group, never a fake ordinal.
function sortedClientGroup(allRows: Opportunity[], o: Opportunity): Opportunity[] {
  if (o.clientId == null) return []
  return allRows
    .filter(r => r.clientId != null && String(r.clientId) === String(o.clientId))
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
}

// This opportunity's 1-based position among all of this customer's deals
// (oldest-first) + the group's total size. No clientId → null, never a fake "1/1".
export function computeOpportunityOrdinal(allRows: Opportunity[], o: Opportunity | null): OpportunityOrdinal | null {
  if (!o) return null
  const group = sortedClientGroup(allRows, o)
  const idx = group.findIndex(r => String(r.id) === String(o.id))
  return idx === -1 ? null : { position: idx + 1, total: group.length }
}

// The OTHER opportunities sharing this customer — StatisticsTab's row list.
// Same oldest-first order the ordinal position counts by; this opportunity's
// own row is excluded.
export function otherOpportunitiesForClient(allRows: Opportunity[], o: Opportunity | null): Opportunity[] {
  if (!o) return []
  return sortedClientGroup(allRows, o).filter(r => String(r.id) !== String(o.id))
}
