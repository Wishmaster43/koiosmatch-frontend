import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RightPanelProvider, useRightPanel } from './RightPanelContext'

// Regression guard for the RightPanelContext ↔ CandidatesPage infinite-loop (2026-07-03):
// a list page registers its filterGroups in an effect on every render. If registerFilters
// setState's on every call, an unstable filterGroups identity loops "Maximum update depth".
// registerFilters is now content-aware — equal content (fresh closures) must be a no-op.
const wrapper = ({ children }: { children: ReactNode }) => <RightPanelProvider>{children}</RightPanelProvider>

describe('RightPanelContext — registerFilters is content-aware', () => {
  it('keeps the same filterGroups reference when re-registering equal content with fresh closures', () => {
    const { result } = renderHook(() => useRightPanel(), { wrapper })

    // First registration.
    act(() => result.current.registerFilters('candidates', [
      { key: 'status', type: 'search-select', label: 'Status', selected: ['a'], options: [{ value: 'a' }], onToggle: () => {} },
    ]))
    const first = result.current.filterGroups
    expect(first).toHaveLength(1)

    // Same meaningful content, brand-new array + brand-new closures (mimics a re-render).
    act(() => result.current.registerFilters('candidates', [
      { key: 'status', type: 'search-select', label: 'Status', selected: ['a'], options: [{ value: 'a' }], onToggle: () => {} },
    ]))
    // No state change → identical reference → no re-render churn → cannot loop.
    expect(result.current.filterGroups).toBe(first)
  })

  it('updates when the selected values actually change', () => {
    const { result } = renderHook(() => useRightPanel(), { wrapper })

    act(() => result.current.registerFilters('candidates', [
      { key: 'status', selected: ['a'], options: [], onToggle: () => {} },
    ]))
    const first = result.current.filterGroups

    act(() => result.current.registerFilters('candidates', [
      { key: 'status', selected: ['a', 'b'], options: [], onToggle: () => {} },
    ]))
    expect(result.current.filterGroups).not.toBe(first)
    expect(result.current.filterGroups[0].selected).toEqual(['a', 'b'])
  })

  it('unregisterFilters removes the entry', () => {
    const { result } = renderHook(() => useRightPanel(), { wrapper })
    act(() => result.current.registerFilters('candidates', [{ key: 'status', selected: [], options: [], onToggle: () => {} }]))
    expect(result.current.filterGroups).toHaveLength(1)
    act(() => result.current.unregisterFilters('candidates'))
    expect(result.current.filterGroups).toHaveLength(0)
  })
})
