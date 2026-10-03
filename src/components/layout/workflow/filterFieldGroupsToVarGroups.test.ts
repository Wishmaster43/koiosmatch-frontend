import { describe, it, expect } from 'vitest'
import { filterFieldGroupsToVarGroups } from './filterFieldGroupsToVarGroups'
import type { FilterFieldGroup } from './filterFieldCatalog'

const groups: FilterFieldGroup[] = [
  { nodeId: 'n1', moduleType: 'sm_candidates', number: 1, fields: [{ key: 'status', label: 'Status' }] },
  { nodeId: 'n2', moduleType: 'candidate_filter', number: 2, fields: [{ key: 'firstname', label: 'Voornaam' }] },
]

describe('filterFieldGroupsToVarGroups', () => {
  it('numbers each group in its customName and tokenises every field as {{N.key}}', () => {
    const result = filterFieldGroupsToVarGroups(groups, type => (type === 'sm_candidates' ? 'SM employees' : 'Candidate filter'))
    expect(result).toEqual([
      { nodeId: 'n1', moduleType: 'sm_candidates', customName: '1. SM employees', hasRun: true,
        fields: [{ token: '{{1.status}}', label: 'status', sample: 'Status' }] },
      { nodeId: 'n2', moduleType: 'candidate_filter', customName: '2. Candidate filter', hasRun: true,
        fields: [{ token: '{{2.firstname}}', label: 'firstname', sample: 'Voornaam' }] },
    ])
  })

  it('returns an empty array for no upstream groups', () => {
    expect(filterFieldGroupsToVarGroups([], t => t)).toEqual([])
  })
})
