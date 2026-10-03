import { describe, it, expect } from 'vitest'
import { lookupItemsForSource, type FilterValueLookups } from './lookupSourceTable'

const lookups: FilterValueLookups = {
  statuses: [{ value: 'available', label: 'Available', color: '#000' }],
  phases: [{ value: 'lead', label: 'Lead', color: '#000' }],
  candidateTypes: [{ value: 'flex', label: 'Flex', color: '#000' }],
  funnelTypes: [{ value: 'applied', label: 'Applied', color: '#000' }],
}

describe('lookupItemsForSource', () => {
  it('maps every known source to its lookup list', () => {
    expect(lookupItemsForSource('candidate_statuses', lookups)).toBe(lookups.statuses)
    expect(lookupItemsForSource('candidate_phases', lookups)).toBe(lookups.phases)
    expect(lookupItemsForSource('candidate_types', lookups)).toBe(lookups.candidateTypes)
    expect(lookupItemsForSource('funnel_types', lookups)).toBe(lookups.funnelTypes)
  })

  it('returns null for an unknown source and for no source at all', () => {
    expect(lookupItemsForSource('something_else', lookups)).toBeNull()
    expect(lookupItemsForSource(undefined, lookups)).toBeNull()
  })
})
