/**
 * useBranchOptions — the two rules that matter, because getting either backwards is
 * silent: an empty `branch_ids` means UNRESTRICTED (every establishment), and a
 * non-empty one narrows to exactly that set.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBranchOptions } from './useBranchOptions'

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

describe('useBranchOptions', () => {
  // An unrestricted user (no branch scope) must see EVERY branch. Treating an empty
  // list as "no branches" would hand an admin an empty filter.
  it('offers every establishment when the user carries no branch scope', () => {
    authUser.current = { branch_ids: [] }
    const { result } = renderHook(() => useBranchOptions())
    expect(result.current.map(o => o.value)).toEqual(['b1', 'b2', 'b3'])
  })

  it('offers every establishment when branch_ids is absent altogether', () => {
    authUser.current = {}
    const { result } = renderHook(() => useBranchOptions())
    expect(result.current).toHaveLength(3)
  })

  // The narrowing case: only the user's own branches, never one outside the scope.
  it('narrows to the user own branches, and drops the rest', () => {
    authUser.current = { branch_ids: ['b2'] }
    const { result } = renderHook(() => useBranchOptions())
    expect(result.current).toEqual([{ value: 'b2', label: 'Rotterdam' }])
  })

  // The backend serialises ids as numbers in some payloads and strings in others, so
  // the comparison is on strings — a numeric id must still match.
  it('matches a numeric branch id against a string option value', () => {
    locationRows.current = [{ value: '7', label: 'Den Haag' }, { value: '8', label: 'Breda' }]
    authUser.current = { branch_ids: [7] }
    const { result } = renderHook(() => useBranchOptions())
    expect(result.current).toEqual([{ value: '7', label: 'Den Haag' }])
    locationRows.current = [
      { value: 'b1', label: 'Amsterdam' },
      { value: 'b2', label: 'Rotterdam' },
      { value: 'b3', label: 'Utrecht' },
    ]
  })
})
