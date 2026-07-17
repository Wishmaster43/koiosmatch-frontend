/**
 * useAssignableRoles — regression test for LOOKUP-GAP-1a: the hook must surface
 * every live tenant role (custom roles included) and never super_admin, even if
 * the backend ever slipped it into the response (defense in depth — RoleController
 * already excludes it server-side, this is the client-side belt).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAssignableRoles } from './useAssignableRoles'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))

// react-query needs a client in the tree; retry:false keeps failed-fetch tests fast.
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useAssignableRoles', () => {
  it('returns custom roles and strips super_admin', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        { id: 1, name: 'planner' },
        { id: 2, name: 'super_admin' },
        { id: 3, name: 'backoffice' },
      ],
    })

    const { result } = renderHook(() => useAssignableRoles(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.roles.map(r => r.name)).toEqual(['planner', 'backoffice'])
  })

  it('starts in a loading state and falls back to an empty list on failure', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useAssignableRoles(), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.roles).toEqual([])
  })
})
