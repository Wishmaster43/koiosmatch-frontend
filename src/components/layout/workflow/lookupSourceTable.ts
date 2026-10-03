/**
 * lookupSourceTable — maps an output field's `source` name (the backend's
 * tenant-lookup identifier, FILTER-MAPPING-1 BE contract) onto the matching
 * list from `LookupsContext` (ADDENDUM 3: candidate_statuses/_phases/_types,
 * funnel_types — only those four for this lane). An unknown source returns
 * null so the caller falls back to the free-chip editor — never a hardcoded
 * vocabulary, never a fake affordance for a source nobody wired yet.
 */
import type { LookupItem } from '@/context/LookupsContext'

export interface FilterValueLookups {
  statuses: LookupItem[]
  phases: LookupItem[]
  candidateTypes: LookupItem[]
  funnelTypes: LookupItem[]
}

const LOOKUP_SOURCE_TABLE: Record<string, keyof FilterValueLookups> = {
  candidate_statuses: 'statuses',
  candidate_phases: 'phases',
  candidate_types: 'candidateTypes',
  funnel_types: 'funnelTypes',
}

// The lookup's items for a given `source` name, or null when the field has no
// source or the source names a lookup this lane does not wire yet.
export function lookupItemsForSource(source: string | undefined, lookups: FilterValueLookups): LookupItem[] | null {
  if (!source) return null
  const key = LOOKUP_SOURCE_TABLE[source]
  return key ? lookups[key] : null
}
