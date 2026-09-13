import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSettingsSectionState } from './useSettingsSectionState'

describe('useSettingsSectionState', () => {
  it('starts loading, not saved/saving/errored, at reloadKey 0', () => {
    const { result } = renderHook(() => useSettingsSectionState())
    expect(result.current.loading).toBe(true)
    expect(result.current.saved).toBe(false)
    expect(result.current.saving).toBe(false)
    expect(result.current.loadError).toBe(false)
    expect(result.current.reloadKey).toBe(0)
  })

  it('each setter flips its own flag independently', () => {
    const { result } = renderHook(() => useSettingsSectionState())
    act(() => {
      result.current.setLoading(false)
      result.current.setSaved(true)
      result.current.setSaving(true)
      result.current.setLoadError(true)
      result.current.setReloadKey(n => n + 1)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.saved).toBe(true)
    expect(result.current.saving).toBe(true)
    expect(result.current.loadError).toBe(true)
    expect(result.current.reloadKey).toBe(1)
  })
})
