/**
 * useVacancyBranchDefault — tests for the branch proposal hook (VAC-VESTIGING-1
 * + fallback). Three cases: customer branch wins, user branch as fallback, manual
 * edit freezes. Mirrors useBranchDefault.test (candidates/drawer/match/).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useVacancyBranchDefault } from './useVacancyBranchDefault'

// Mock AuthContext to provide branch_ids.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'recruiter-1',
      name: 'Piet Recruiter',
      branch_ids: ['user-branch-1', 'user-branch-2'],
    },
  }),
}))

// Mock useCustomerCascade to provide customer branch detail.
const { cascadeState } = vi.hoisted(() => ({
  cascadeState: {
    detail: null as { branch_id?: string } | null,
  },
}))
vi.mock('../hooks/useCustomerCascade', () => ({
  useCustomerCascade: () => ({
    detail: cascadeState.detail,
    locations: [],
    contacts: [],
    refetch: vi.fn(),
  }),
}))

beforeEach(() => {
  cascadeState.detail = null
})

describe('useVacancyBranchDefault', () => {
  it('proposes the customer branch when it exists', async () => {
    cascadeState.detail = { branch_id: 'customer-branch-1' }
    const setBranchId = vi.fn()
    const { result } = renderHook(() => useVacancyBranchDefault('customer-1', setBranchId))

    // The proposal should have set the customer branch on mount.
    await waitFor(() => {
      expect(setBranchId).toHaveBeenCalledWith('customer-branch-1')
    })
    expect(result.current.handleBranchChange).toBeDefined()
  })

  it('falls back to the recruiter\'s first branch when customer has no branch_id', async () => {
    cascadeState.detail = {} // No branch_id on customer.
    const setBranchId = vi.fn()
    renderHook(() => useVacancyBranchDefault('customer-2', setBranchId))

    // Should fall back to the recruiter's first branch.
    await waitFor(() => {
      expect(setBranchId).toHaveBeenCalledWith('user-branch-1')
    })
  })

  it('manual edit via handleBranchChange freezes the proposal from re-running', async () => {
    cascadeState.detail = { branch_id: 'customer-branch-1' }
    const setBranchId = vi.fn()
    const { result, rerender } = renderHook(
      ({ clientId }) => useVacancyBranchDefault(clientId, setBranchId),
      { initialProps: { clientId: 'c1' } }
    )

    // Initial proposal should fire.
    await waitFor(() => {
      expect(setBranchId).toHaveBeenCalledWith('customer-branch-1')
    })

    // User manually picks a different branch via handleBranchChange.
    act(() => {
      result.current.handleBranchChange('branch-manual')
    })
    setBranchId.mockClear()

    // Change the customer detail — the hook should NOT re-propose.
    await act(async () => {
      cascadeState.detail = { branch_id: 'customer-branch-2' }
      rerender({ clientId: 'c1' })
    })

    // Verify setBranchId was not called again (no re-proposal after manual edit).
    expect(setBranchId).not.toHaveBeenCalled()
  })
})
