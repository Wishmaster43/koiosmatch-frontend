/**
 * useVacancyBranchDefault — tests for the branch proposal hook (VAC-VESTIGING-1
 * + fallback). Three cases: customer branch wins, user branch as fallback, manual
 * edit freezes. Mirrors useBranchDefault.test (candidates/drawer/match/).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useVacancyBranchDefault } from './useVacancyBranchDefault'

// Mock AuthContext to provide default_branch_id, default_branch, and branch_ids.
const { authState } = vi.hoisted(() => ({
  authState: {
    user: {
      id: 'recruiter-1',
      name: 'Piet Recruiter',
      default_branch_id: null as string | number | null,
      default_branch: null as { id: string | number; name: string } | null,
      branch_ids: ['user-branch-1', 'user-branch-2'],
    },
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
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
  authState.user.default_branch_id = null
  authState.user.default_branch = null
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

  it('default_branch_id wins over branch_ids[0] when customer has no branch_id (K-284)', async () => {
    authState.user.default_branch_id = 'default-user-branch'
    cascadeState.detail = {} // No branch_id on customer.
    const setBranchId = vi.fn()
    renderHook(() => useVacancyBranchDefault('customer-2', setBranchId))

    // Should use the default_branch_id, not branch_ids[0].
    await waitFor(() => {
      expect(setBranchId).toHaveBeenCalledWith('default-user-branch')
    })
  })
})
