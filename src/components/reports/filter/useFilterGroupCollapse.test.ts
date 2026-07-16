import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilterGroupCollapse } from './useFilterGroupCollapse'

// Regression guard for KANDIDAAT-100 punt 31 (right filter panel redesign):
// frequently-used groups default open, the rest default closed, and whatever
// the user toggles persists per page across a reload (localStorage).
describe('useFilterGroupCollapse', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults the first `defaultOpenCount` groups open and the rest closed', () => {
    const groups = ['status', 'phase', 'funnel', 'type', 'title', 'pool'].map(key => ({ key }))
    const { result } = renderHook(() => useFilterGroupCollapse('candidates', groups))

    expect(result.current.isCollapsed('status')).toBe(false)
    expect(result.current.isCollapsed('phase')).toBe(false)
    expect(result.current.isCollapsed('funnel')).toBe(false)
    expect(result.current.isCollapsed('type')).toBe(false)
    // 5th+ group: default closed.
    expect(result.current.isCollapsed('title')).toBe(true)
    expect(result.current.isCollapsed('pool')).toBe(true)
  })

  it('honours a per-group `collapsed` override ahead of the index default', () => {
    const groups = [{ key: 'status' }, { key: 'phase' }, { key: 'rare', collapsed: false }]
    const { result } = renderHook(() => useFilterGroupCollapse('candidates', groups, 1))
    // 'rare' is index 2, past defaultOpenCount=1, but its own flag says open.
    expect(result.current.isCollapsed('rare')).toBe(false)
    expect(result.current.isCollapsed('phase')).toBe(true)
  })

  it('toggle() flips a single group and persists it', () => {
    const groups = [{ key: 'status' }, { key: 'phase' }, { key: 'funnel' }, { key: 'type' }, { key: 'title' }]
    const { result } = renderHook(() => useFilterGroupCollapse('candidates', groups))

    expect(result.current.isCollapsed('title')).toBe(true)
    act(() => result.current.toggle('title'))
    expect(result.current.isCollapsed('title')).toBe(false)

    // A fresh hook instance for the SAME page picks up the persisted choice —
    // this is what "reload the page" looks like from the hook's perspective.
    const { result: reloaded } = renderHook(() => useFilterGroupCollapse('candidates', groups))
    expect(reloaded.current.isCollapsed('title')).toBe(false)
  })

  it('expandAll() opens every group and collapseAll() closes every group', () => {
    const groups = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }, { key: 'e' }, { key: 'f' }]
    const { result } = renderHook(() => useFilterGroupCollapse('candidates', groups))

    expect(result.current.isCollapsed('f')).toBe(true)
    act(() => result.current.expandAll())
    groups.forEach(g => expect(result.current.isCollapsed(g.key)).toBe(false))
    expect(result.current.allExpanded).toBe(true)

    act(() => result.current.collapseAll())
    groups.forEach(g => expect(result.current.isCollapsed(g.key)).toBe(true))
    expect(result.current.allExpanded).toBe(false)
  })

  it('keeps collapse state isolated per page id', () => {
    const groups = [{ key: 'status' }]
    const { result: candidates } = renderHook(() => useFilterGroupCollapse('candidates', groups))
    const { result: applications } = renderHook(() => useFilterGroupCollapse('applications', groups))

    act(() => candidates.current.toggle('status'))
    // Toggling on the candidates page must not affect the applications page's copy.
    expect(candidates.current.isCollapsed('status')).toBe(true)
    expect(applications.current.isCollapsed('status')).toBe(false)
  })
})
