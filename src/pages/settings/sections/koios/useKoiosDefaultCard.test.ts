/**
 * useKoiosDefaultCard.test.ts — shared head of the two Koios default cards:
 * the settings.update edit gate, the live settings blob, and independent
 * saving/error state.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useKoiosDefaultCard } from './useKoiosDefaultCard'

const mockSettings = vi.hoisted(() => vi.fn(() => ({ koios_default_effort: 'high' } as Record<string, unknown>)))
const mockUseAuth = vi.hoisted(() => vi.fn((): { hasPermission: (p: string) => boolean } => ({ hasPermission: () => true })))

vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

afterEach(() => vi.clearAllMocks())

describe('useKoiosDefaultCard', () => {
  it('gates canEdit on settings.update and exposes the live settings blob', () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p) => p === 'settings.update' })
    const { result } = renderHook(() => useKoiosDefaultCard())
    expect(result.current.canEdit).toBe(true)
    expect(result.current.values).toEqual({ koios_default_effort: 'high' })
    expect(result.current.saving).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('canEdit is false without settings.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    const { result } = renderHook(() => useKoiosDefaultCard())
    expect(result.current.canEdit).toBe(false)
  })

  it('exposes independent setSaving/setError setters', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    const { result } = renderHook(() => useKoiosDefaultCard())

    act(() => { result.current.setSaving('koios_default_effort') })
    expect(result.current.saving).toBe('koios_default_effort')

    act(() => { result.current.setError('boom') })
    expect(result.current.error).toBe('boom')
  })
})
