/** useOffboardingState — /auth/me fields and the 423 gate both raise the wall. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOffboardingState } from './useOffboardingState'
import { useAuth } from '@/context/AuthContext'
import { detectOffboarding, resetOffboardingGate } from '@/lib/offboardingGate'

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
const asUser = (tenant: Record<string, unknown> | undefined) =>
  vi.mocked(useAuth).mockReturnValue({ user: { id: 1, tenant } } as unknown as ReturnType<typeof useAuth>)

beforeEach(() => { vi.clearAllMocks(); resetOffboardingGate() })

describe('useOffboardingState', () => {
  it('is true with offboarding_due_at and carries the date', () => {
    asUser({ id: 't', offboarding_due_at: '2026-12-06T23:00:00+00:00' })
    expect(renderHook(() => useOffboardingState()).result.current).toEqual({ offboarding: true, dueAt: '2026-12-06T23:00:00+00:00' })
  })
  it('is true for an active offboarding_status without a date', () => {
    asUser({ id: 't', offboarding_status: 'grace' })
    expect(renderHook(() => useOffboardingState()).result.current).toEqual({ offboarding: true, dueAt: null })
  })
  it('is false for a normal bureau and for a cancelled run', () => {
    asUser({ id: 't', provisioning_status: 'ready', offboarding_due_at: null, offboarding_status: null })
    expect(renderHook(() => useOffboardingState()).result.current.offboarding).toBe(false)
    asUser({ id: 't', offboarding_status: 'cancelled' })
    expect(renderHook(() => useOffboardingState()).result.current.offboarding).toBe(false)
  })
  it('turns true after a 423 tenant_offboarding and ignores a signed-out user', () => {
    asUser({ id: 't' })
    const { result } = renderHook(() => useOffboardingState())
    expect(result.current.offboarding).toBe(false)
    act(() => detectOffboarding({ response: { status: 423, data: { code: 'tenant_offboarding', offboarding_due_at: '2026-12-06T23:00:00+00:00' } } }))
    expect(result.current).toEqual({ offboarding: true, dueAt: '2026-12-06T23:00:00+00:00' })
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>)
    expect(renderHook(() => useOffboardingState()).result.current.offboarding).toBe(false)
  })
})
