/**
 * useRoleBranchTemplate — the NewUserModal branch-template preview: no fetch
 * (and no branches) until a role is actually picked, then loads GET
 * /roles/{id}/branches (USERS-ROLES-LOC-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRoleBranchTemplate } from './useRoleBranchTemplate'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useRoleBranchTemplate', () => {
  it('does not fetch and reports no branches when nothing is picked', () => {
    const { result } = renderHook(() => useRoleBranchTemplate(null), { wrapper })
    expect(result.current.branches).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('loads the template once a role id is given', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ location_id: 'loc-1', name: 'Amsterdam' }] } })
    const { result } = renderHook(() => useRoleBranchTemplate(7), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.branches).toEqual([{ location_id: 'loc-1', name: 'Amsterdam' }])
    expect(api.get).toHaveBeenCalledWith('/roles/7/branches', expect.anything())
  })
})
