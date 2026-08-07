/**
 * queries.ts — useUsers tenant-scoping regression test (bijvangst fix, 2026-08).
 *
 * The `['users']` React Query key had no tenant identifier: a super-admin
 * switching bureaus mid-session (before AuthContext's clear()+reload lands, or
 * if that safety net ever changes) could see the PREVIOUS tenant's user list
 * served straight from cache in every owner/recruiter picker — special-category
 * health-data isolation must be absolute (AVG, §3B/§8). This covers: same
 * tenant → cache reuse (no extra GET), different tenant → a real refetch that
 * never hands back the other tenant's rows.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Preserve the real unwrapList (used by useUsers) via importActual — only the
// network call and the active-tenant getter are stubbed.
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, default: { get: vi.fn() }, getActiveTenantId: vi.fn(() => null) }
})

import api, { getActiveTenantId } from './api'
import { useUsers } from './queries'

const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)

afterEach(() => {
  vi.clearAllMocks()
  mockedTenantId.mockReturnValue(null)
})

// One fresh QueryClient per render (no cross-test cache leakage). retry:false
// keeps a rejected fetch fast; staleTime mirrors the real queryClient.ts (30s) —
// the default staleTime:0 would make React Query refetch on every new mount
// regardless of the key, which would falsely look like a cache-scoping bug here.
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useUsers · tenant scoping', () => {
  // Same tenant across two hook instances sharing one QueryClient: the second
  // reads the cached page — no second GET (unchanged React Query dedupe/caching).
  it('reuses the cached list when the tenant is unchanged', async () => {
    mockedTenantId.mockReturnValue('tenant-a')
    mockedGet.mockResolvedValue({ data: [{ id: 1, name: 'Alice (tenant A)' }] })

    const wrapper = makeWrapper()
    const first = renderHook(() => useUsers(), { wrapper })
    await waitFor(() => expect(first.result.current.data).toHaveLength(1))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useUsers(), { wrapper })
    await waitFor(() => expect(second.result.current.data?.[0]).toMatchObject({ name: 'Alice (tenant A)' }))
    expect(mockedGet).toHaveBeenCalledTimes(1) // still just the one GET — cache hit
  })

  // Different active tenant, same QueryClient: the key changes, so React Query
  // treats it as a fresh query — a real GET fires and tenant B's rows land,
  // never tenant A's cached list.
  it('refetches and never leaks the previous tenant\'s users after a tenant switch', async () => {
    mockedTenantId.mockReturnValue('tenant-a')
    mockedGet.mockResolvedValue({ data: [{ id: 1, name: 'Alice (tenant A)' }] })

    const wrapper = makeWrapper()
    const forTenantA = renderHook(() => useUsers(), { wrapper })
    await waitFor(() => expect(forTenantA.result.current.data).toHaveLength(1))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    // Simulate the switch: X-Tenant now resolves to a different tenant.
    mockedTenantId.mockReturnValue('tenant-b')
    mockedGet.mockResolvedValue({ data: [{ id: 2, name: 'Bob (tenant B)' }] })

    const forTenantB = renderHook(() => useUsers(), { wrapper })
    await waitFor(() => expect(forTenantB.result.current.data?.[0]).toMatchObject({ name: 'Bob (tenant B)' }))
    expect(mockedGet).toHaveBeenCalledTimes(2) // a real second GET, not a cache hit
    const namesForB = (forTenantB.result.current.data as Array<{ name: string }> | undefined) ?? []
    expect(namesForB.some(u => u.name.includes('tenant A'))).toBe(false)
  })
})
