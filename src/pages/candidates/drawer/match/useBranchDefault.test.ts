/**
 * useBranchDefault — tests for the branch proposal hook (MATCH-BRANCH-DEFAULT-1
 * + K-284 fallback). Six cases: customer branch wins, default_branch_id over
 * branch_ids[0], branch_ids[0] fallback, tenant default, and manual edit freezes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useBranchDefault } from './useBranchDefault'

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
vi.mock('@/hooks/useCustomerCascade', () => ({
  useCustomerCascade: () => ({
    detail: cascadeState.detail,
  }),
}))

beforeEach(() => {
  cascadeState.detail = null
  authState.user.default_branch_id = null
  authState.user.default_branch = null
})

describe('useBranchDefault', () => {
  it('proposes the customer branch when it exists', async () => {
    cascadeState.detail = { branch_id: 'customer-branch-1' }
    const locations = [{ value: 'tenant-default', label: 'Tenant Default', is_default: true }]
    const { result } = renderHook(() => useBranchDefault(cascadeState.detail, locations))

    // The proposal should have set the customer branch on mount.
    await waitFor(() => {
      expect(result.current.branchId).toBe('customer-branch-1')
    })
  })

  it('falls back to default_branch_id when customer has no branch_id (K-284)', async () => {
    authState.user.default_branch_id = 'default-user-branch'
    cascadeState.detail = {} // No branch_id on customer.
    const locations = [{ value: 'tenant-default', label: 'Tenant Default', is_default: true }]
    const { result } = renderHook(() => useBranchDefault(cascadeState.detail, locations))

    // Should use default_branch_id over branch_ids[0].
    await waitFor(() => {
      expect(result.current.branchId).toBe('default-user-branch')
    })
  })

  it('falls back to branch_ids[0] when customer has no branch_id and no default_branch_id', async () => {
    cascadeState.detail = {} // No branch_id on customer.
    const locations = [{ value: 'tenant-default', label: 'Tenant Default', is_default: true }]
    const { result } = renderHook(() => useBranchDefault(cascadeState.detail, locations))

    // Should fall back to the recruiter's first branch.
    await waitFor(() => {
      expect(result.current.branchId).toBe('user-branch-1')
    })
  })

  it('falls back to tenant default when recruiter has no branches', async () => {
    authState.user.branch_ids = []
    cascadeState.detail = null
    const locations = [{ value: 'tenant-default', label: 'Tenant Default', is_default: true }]
    const { result } = renderHook(() => useBranchDefault(cascadeState.detail, locations))

    // Should fall back to the tenant default location.
    await waitFor(() => {
      expect(result.current.branchId).toBe('tenant-default')
    })
  })

  it('manual edit via setBranchDirty freezes the proposal from re-running', async () => {
    cascadeState.detail = { branch_id: 'customer-branch-1' }
    const locations = [{ value: 'tenant-default', label: 'Tenant Default', is_default: true }]
    const { result, rerender } = renderHook(
      ({ detail, locations }) => useBranchDefault(detail, locations),
      { initialProps: { detail: cascadeState.detail, locations } }
    )

    // Initial proposal should fire.
    await waitFor(() => {
      expect(result.current.branchId).toBe('customer-branch-1')
    })

    // User manually sets a different branch via setBranchDirty.
    act(() => {
      result.current.setBranchId('branch-manual')
      result.current.setBranchDirty(true)
    })

    // Change the customer detail — the hook should NOT re-propose.
    await act(async () => {
      cascadeState.detail = { branch_id: 'customer-branch-2' }
      rerender({ detail: cascadeState.detail, locations })
    })

    // Verify branchId stayed frozen at manual pick.
    expect(result.current.branchId).toBe('branch-manual')
  })

  it('customer branch wins over default_branch_id (deepest-first)', async () => {
    authState.user.default_branch_id = 'default-user-branch'
    cascadeState.detail = { branch_id: 'customer-branch-1' }
    const locations = [{ value: 'tenant-default', label: 'Tenant Default', is_default: true }]
    const { result } = renderHook(() => useBranchDefault(cascadeState.detail, locations))

    // Customer branch should win over the user's default.
    await waitFor(() => {
      expect(result.current.branchId).toBe('customer-branch-1')
    })
  })
})
