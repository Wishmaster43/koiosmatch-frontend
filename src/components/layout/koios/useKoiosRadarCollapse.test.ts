import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useKoiosRadarCollapse } from './useKoiosRadarCollapse'

// Mirrors useKoiosPanelWidth.test.ts's own localStorage convention (same
// storage-key-per-preference idiom, same beforeEach clear).
describe('useKoiosRadarCollapse', () => {
  beforeEach(() => localStorage.clear())

  // Requirement: nothing stored yet → open by default (Danny only asked for
  // the ABILITY to close it, never a new default).
  it('defaults to open (not collapsed) with nothing stored', () => {
    const { result } = renderHook(() => useKoiosRadarCollapse())
    expect(result.current.collapsed).toBe(false)
  })

  // Requirement: a previously chosen collapsed state survives a reload.
  it('restores a stored collapsed=true value', () => {
    localStorage.setItem('koios.radar.collapsed', 'true')
    const { result } = renderHook(() => useKoiosRadarCollapse())
    expect(result.current.collapsed).toBe(true)
  })

  // A corrupt/unexpected stored value degrades to the default (open), never throws.
  it('falls back to open on a corrupt stored value', () => {
    localStorage.setItem('koios.radar.collapsed', 'not-a-boolean')
    const { result } = renderHook(() => useKoiosRadarCollapse())
    expect(result.current.collapsed).toBe(false)
  })

  // Persistence: setting the value writes it back under the same key so the
  // NEXT mount reads it directly.
  it('persists a collapsed choice under the storage key', () => {
    const { result } = renderHook(() => useKoiosRadarCollapse())
    act(() => result.current.setCollapsed(true))
    expect(result.current.collapsed).toBe(true)
    expect(localStorage.getItem('koios.radar.collapsed')).toBe('true')
  })

  // Toggling back to open persists too — not just the one-way close.
  it('persists reopening after a collapse', () => {
    localStorage.setItem('koios.radar.collapsed', 'true')
    const { result } = renderHook(() => useKoiosRadarCollapse())
    act(() => result.current.setCollapsed(false))
    expect(result.current.collapsed).toBe(false)
    expect(localStorage.getItem('koios.radar.collapsed')).toBe('false')
  })
})
