/**
 * useAssignableBranches — ONIX D-003: a branch-restricted user is offered only the
 * branches they hold (empty grants = unrestricted); narrowToGrants is the shared
 * pure narrowing both this hook and useBranchOptions build on; withCurrentOption
 * keeps a record's current branch visible even when it sits outside the grants.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAssignableBranches, narrowToGrants, withCurrentOption } from './useAssignableBranches'

const authUser = vi.hoisted(() => ({ current: null as { branch_ids?: Array<string | number> } | null }))
const locationRows = vi.hoisted(() => ({
  current: [
    { value: 'b1', label: 'Amsterdam' },
    { value: 'b2', label: 'Rotterdam' },
    { value: 'b3', label: 'Utrecht' },
  ],
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authUser.current }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => locationRows.current }))

beforeEach(() => { authUser.current = null })

describe('narrowToGrants (pure)', () => {
  const locations = [{ value: 'b1', label: 'Amsterdam' }, { value: 'b2', label: 'Rotterdam' }]

  it('returns every location when branchIds is empty', () => {
    expect(narrowToGrants(locations, [])).toEqual(locations)
  })

  it('returns every location when branchIds is undefined', () => {
    expect(narrowToGrants(locations, undefined)).toEqual(locations)
  })

  it('keeps only the granted locations, comparing as strings', () => {
    expect(narrowToGrants(locations, [2])).toEqual([])
    expect(narrowToGrants([{ value: 2, label: 'Breda' }], ['2'])).toEqual([{ value: 2, label: 'Breda' }])
  })
})

describe('withCurrentOption (pure)', () => {
  const options = [{ value: 'b1', label: 'Amsterdam' }]

  it('appends the current option when missing', () => {
    expect(withCurrentOption(options, { value: 'b9', label: 'Foreign' }))
      .toEqual([{ value: 'b1', label: 'Amsterdam' }, { value: 'b9', label: 'Foreign' }])
  })

  it('does not duplicate when the current value is already present', () => {
    expect(withCurrentOption(options, { value: 'b1', label: 'Amsterdam' })).toEqual(options)
  })

  it('passes options through unchanged when there is no current value', () => {
    expect(withCurrentOption(options, null)).toEqual(options)
    expect(withCurrentOption(options, { value: '', label: '' })).toEqual(options)
  })
})

describe('useAssignableBranches', () => {
  // Unrestricted (no grants) must see every establishment.
  it('offers every establishment when the user carries no branch scope', () => {
    authUser.current = { branch_ids: [] }
    const { result } = renderHook(() => useAssignableBranches())
    expect(result.current.map(o => o.value)).toEqual(['b1', 'b2', 'b3'])
  })

  // The narrowing case: only the user's own branches, never the "none" sentinel.
  it('narrows to the user own branches, with no "none" sentinel', () => {
    authUser.current = { branch_ids: ['b2'] }
    const { result } = renderHook(() => useAssignableBranches())
    expect(result.current).toEqual([{ value: 'b2', label: 'Rotterdam' }])
  })

  it('matches a numeric branch id against a string option value', () => {
    locationRows.current = [{ value: '7', label: 'Den Haag' }, { value: '8', label: 'Breda' }]
    authUser.current = { branch_ids: [7] }
    const { result } = renderHook(() => useAssignableBranches())
    expect(result.current).toEqual([{ value: '7', label: 'Den Haag' }])
    locationRows.current = [
      { value: 'b1', label: 'Amsterdam' },
      { value: 'b2', label: 'Rotterdam' },
      { value: 'b3', label: 'Utrecht' },
    ]
  })
})
