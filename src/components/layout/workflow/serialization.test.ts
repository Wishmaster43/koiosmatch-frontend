/**
 * Unit tests for the edge-filter OR-group shape helpers in serialization.ts —
 * the flat/nested round-trip is exactly what keeps saved workflows backward
 * compatible (WF-ROUTER OR-groups), so it's worth pinning down explicitly.
 */
import { describe, it, expect } from 'vitest'
import { parseEdgeFilterGroups, edgeFilterGroupsToFilters, countEdgeFilterConditions } from './serialization'
import type { FilterCondition } from '@/types/workflow'

const c = (field: string): FilterCondition => ({ field, operator: '=', value: 'x' })

describe('parseEdgeFilterGroups', () => {
  it('starts as one empty group when there is nothing saved yet', () => {
    expect(parseEdgeFilterGroups(null)).toEqual([[]])
    expect(parseEdgeFilterGroups(undefined)).toEqual([[]])
    expect(parseEdgeFilterGroups({})).toEqual([[]])
  })

  it('reads the legacy flat {conditions,logic} shape as one AND-group', () => {
    const legacy = { conditions: [c('a'), c('b')], logic: 'OR' }
    expect(parseEdgeFilterGroups(legacy)).toEqual([[c('a'), c('b')]])
  })

  it('reads a bare flat array (no wrapper) as one AND-group', () => {
    expect(parseEdgeFilterGroups([c('a'), c('b')])).toEqual([[c('a'), c('b')]])
  })

  it('reads a nested array-of-arrays as N OR-groups', () => {
    const nested = [[c('a')], [c('b'), c('c')]]
    expect(parseEdgeFilterGroups(nested)).toEqual(nested)
  })

  it('also accepts a nested shape wrapped in {conditions} defensively', () => {
    const wrapped = { conditions: [[c('a')], [c('b')]] }
    expect(parseEdgeFilterGroups(wrapped)).toEqual([[c('a')], [c('b')]])
  })
})

describe('edgeFilterGroupsToFilters', () => {
  it('persists a single group in the exact legacy shape (backward compatible)', () => {
    expect(edgeFilterGroupsToFilters([[c('a'), c('b')]])).toEqual({ conditions: [c('a'), c('b')], logic: 'AND' })
  })

  it('persists zero/only-empty groups as the legacy empty-conditions shape', () => {
    expect(edgeFilterGroupsToFilters([[]])).toEqual({ conditions: [], logic: 'AND' })
    expect(edgeFilterGroupsToFilters([[], []])).toEqual({ conditions: [], logic: 'AND' })
  })

  it('drops wholly-empty groups before deciding flat vs. nested', () => {
    expect(edgeFilterGroupsToFilters([[], [c('a')]])).toEqual({ conditions: [c('a')], logic: 'AND' })
  })

  it('emits the raw nested [[…],[…]] shape once ≥2 non-empty groups exist', () => {
    const groups = [[c('a')], [c('b'), c('c')]]
    expect(edgeFilterGroupsToFilters(groups)).toEqual(groups)
  })
})

describe('countEdgeFilterConditions', () => {
  it('is 0 for no filter', () => {
    expect(countEdgeFilterConditions(null)).toBe(0)
    expect(countEdgeFilterConditions(undefined)).toBe(0)
  })

  it('counts across the legacy flat shape', () => {
    expect(countEdgeFilterConditions({ conditions: [c('a'), c('b')], logic: 'AND' })).toBe(2)
  })

  it('counts across every OR-group in the nested shape', () => {
    expect(countEdgeFilterConditions([[c('a')], [c('b'), c('c')]])).toBe(3)
  })
})
