/**
 * useUserPreference — pins the contract from the module doc comment (audit
 * finding r1-hooks-b/SHARED-UNIT-TEST-1): initial value reads from the auth
 * user's ui_preferences, a write PUTs the FULL merged blob (never just the
 * changed key, since the backend replaces the column instead of deep-merging
 * it), and a rejected write never reverts the local value.
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authModule from '@/context/AuthContext'
import api from '@/lib/api'
import { useUserPreference } from './useUserPreference'

vi.mock('@/context/AuthContext')
vi.mock('@/lib/api', () => ({ default: { put: vi.fn() } }))

function mockAuth(uiPreferences: Record<string, unknown> | null, refreshUser = vi.fn()) {
  vi.mocked(authModule.useAuth).mockReturnValue({
    user: { ui_preferences: uiPreferences },
    refreshUser,
  } as unknown as ReturnType<typeof authModule.useAuth>)
  return refreshUser
}

describe('useUserPreference', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the initial value from the stored key, falling back when absent', () => {
    mockAuth({ sortOrder: 'newest' })
    const { result } = renderHook(() => useUserPreference('sortOrder', 'oldest'))
    expect(result.current[0]).toBe('newest')

    mockAuth({})
    const { result: withFallback } = renderHook(() => useUserPreference('sortOrder', 'oldest'))
    expect(withFallback.current[0]).toBe('oldest')
  })

  it('updates local state immediately and PUTs the FULL merged blob, never just the changed key', async () => {
    vi.mocked(api.put).mockResolvedValue({} as never)
    const refreshUser = mockAuth({ otherFeatureKey: 'keepMe' })
    const { result } = renderHook(() => useUserPreference('sortOrder', 'oldest'))

    await act(async () => { result.current[1]('newest') })

    expect(result.current[0]).toBe('newest')
    expect(api.put).toHaveBeenCalledWith('/auth/me', {
      ui_preferences: { otherFeatureKey: 'keepMe', sortOrder: 'newest' },
    })
    expect(refreshUser).toHaveBeenCalled()
  })

  it('never reverts the local value when the save is rejected', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('network'))
    mockAuth({})
    const { result } = renderHook(() => useUserPreference('sortOrder', 'oldest'))

    await act(async () => { result.current[1]('newest') })

    expect(result.current[0]).toBe('newest')
  })
})
