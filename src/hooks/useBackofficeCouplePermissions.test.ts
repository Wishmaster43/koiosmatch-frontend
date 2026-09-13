/**
 * useBackofficeCouplePermissions — the shared "can this bulk bar offer
 * backoffice coupling" gate, shared by candidates/customers bulk bars (see
 * file doc). Mocks useAuth/useApps like the bulk-bar suites do.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseAuth = vi.fn()
const mockUseApps = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))

import { useBackofficeCouplePermissions } from './useBackofficeCouplePermissions'

describe('useBackofficeCouplePermissions', () => {
  it('grants coupling only when the given permission is held', () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'candidates.update' })
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const { result } = renderHook(() => useBackofficeCouplePermissions('candidates.update'))
    expect(result.current.canCouple).toBe(true)
  })
  it('shows helloflex/shiftmanager only when that app is enabled for the tenant', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'hf' })
    const { result } = renderHook(() => useBackofficeCouplePermissions('customers.update'))
    expect(result.current.showHelloflex).toBe(true)
    expect(result.current.showShiftmanager).toBe(false)
  })
  it('falls back to false when the contexts are unavailable', () => {
    mockUseAuth.mockReturnValue(null)
    mockUseApps.mockReturnValue(null)
    const { result } = renderHook(() => useBackofficeCouplePermissions('candidates.update'))
    expect(result.current).toEqual({ canCouple: false, showHelloflex: false, showShiftmanager: false })
  })
})
