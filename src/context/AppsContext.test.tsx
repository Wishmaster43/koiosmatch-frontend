/**
 * AppsContext — TENANT-GATE-FE-1 (29-10, Danny's console on TenantPickPage): the provider mounts
 * in the app shell above the bureau pick, so it must not ask GET /settings/apps before a bureau is
 * chosen (400 tenant_required by design, ONIX B-003), and it must refetch after the pick and on a
 * tenant switch (the old `[user?.id]` dependency never did).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { AppsProvider, useApps } from './AppsContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

// Mutable fake session so each test drives the bureau-pick gate (vi.hoisted: the factory runs above the imports).
const authState = vi.hoisted(() => ({ current: { user: { id: 'u1' } } as Record<string, unknown> }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authState.current }))

const wrapper = ({ children }: { children: ReactNode }) => <AppsProvider>{children}</AppsProvider>

afterEach(() => { vi.clearAllMocks(); localStorage.clear(); authState.current = { user: { id: 'u1' } } })

describe('AppsContext · bureau gate (ONIX B-003 tenant_required)', () => {
  it('asks nothing while a bureau still has to be picked, then fetches the enabled apps once one is set', async () => {
    authState.current = { user: { id: 'u1' }, needsTenantPick: true, activeTenant: null }
    mockedGet.mockResolvedValue({ data: { enabled: ['whatsapp'] } })
    const { result, rerender } = renderHook(() => useApps(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(mockedGet).not.toHaveBeenCalled()
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't1' } }
    rerender()
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    expect(mockedGet).toHaveBeenCalledWith('/settings/apps')
    await waitFor(() => expect(result.current?.isAppEnabled('whatsapp')).toBe(true))
  })

  it('refetches the enabled apps when the active bureau changes for the same user', async () => {
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't1' } }
    mockedGet.mockResolvedValue({ data: { enabled: [] } })
    const { rerender } = renderHook(() => useApps(), { wrapper })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't2' } }
    rerender()
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
  })

  it('stays quiet without a session (pre-login shell)', async () => {
    authState.current = { user: null }
    const { result } = renderHook(() => useApps(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(mockedGet).not.toHaveBeenCalled()
  })
})
