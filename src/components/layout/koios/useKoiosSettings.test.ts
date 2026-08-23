/**
 * useKoiosSettings — KOIOS-DEFAULT-SYNC-1: a default changed elsewhere (the
 * Settings → Koios AI model card) must reach an already-open panel. Pins the
 * lazy first load and the refetch on invalidateKoiosSettings().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockGet = vi.fn()
vi.mock('./koiosApi', () => ({ getKoiosSettings: () => mockGet() }))
import { useKoiosSettings, invalidateKoiosSettings } from './useKoiosSettings'

beforeEach(() => { mockGet.mockReset() })

describe('useKoiosSettings', () => {
  it('loads lazily once the panel is open and never before', async () => {
    mockGet.mockResolvedValue({ models: { active: 'claude-haiku-4-5', selectable: ['claude-haiku-4-5', 'claude-sonnet-5'] } })
    const { result, rerender } = renderHook(({ open }) => useKoiosSettings(open), { initialProps: { open: false } })
    expect(mockGet).not.toHaveBeenCalled()
    rerender({ open: true })
    await waitFor(() => expect(result.current.settings?.models?.active).toBe('claude-haiku-4-5'))
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('refetches when the tenant default changes elsewhere (invalidateKoiosSettings)', async () => {
    mockGet.mockResolvedValueOnce({ models: { active: 'claude-haiku-4-5', selectable: ['claude-haiku-4-5', 'claude-sonnet-5'] } })
    const { result } = renderHook(() => useKoiosSettings(true))
    await waitFor(() => expect(result.current.settings?.models?.active).toBe('claude-haiku-4-5'))
    mockGet.mockResolvedValueOnce({ models: { active: 'claude-sonnet-5', selectable: ['claude-haiku-4-5', 'claude-sonnet-5'] } })
    act(() => { invalidateKoiosSettings() })
    await waitFor(() => expect(result.current.settings?.models?.active).toBe('claude-sonnet-5'))
    expect(mockGet).toHaveBeenCalledTimes(2)
  })
})
