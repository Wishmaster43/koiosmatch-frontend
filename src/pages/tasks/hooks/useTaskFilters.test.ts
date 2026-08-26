/**
 * useTaskFilters — NUMMER-1 reference-number detection. Typing T-00042 must flip
 * the header search from the client-side free-text filter to an exact server-side
 * `?ref=` lookup (TaskQuery returns early on `ref`), and the row predicate must
 * then STOP re-filtering on that text — otherwise the one task the server just
 * found is filtered straight back out, because the predicate never reads the
 * reference number. Anything that is not a reference number keeps the old
 * free-text behaviour untouched.
 *
 * usePageMemory is a MODULE-LEVEL store shared across every test in this file, so
 * each test clears its own search text again before finishing.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTaskFilters } from './useTaskFilters'

// Reset the shared page-memory search between tests ().
afterEach(() => {
  const { result } = renderHook(() => useTaskFilters())
  act(() => result.current.clearAllFilters())
})

// One task whose text matches NOTHING of the typed reference number — exactly the
// row the server returns for ?ref=T-00042.
const taskFoundByRef = { title: 'Bellen met kandidaat', description: 'Terugbelverzoek', assignee: null }

describe('useTaskFilters · reference-number query (NUMMER-1)', () => {
  it('exposes refQuery for a typed reference number so the fetch can send ?ref=', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('T-00042'))
    expect(result.current.refQuery).toBe('T-00042')
  })

  it('trims surrounding whitespace before detecting (a pasted number keeps working)', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('  T-00042  '))
    expect(result.current.refQuery).toBe('T-00042')
  })

  it('keeps refQuery null for ordinary free text — the fallback stays free-text search', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('bellen'))
    expect(result.current.refQuery).toBeNull()
  })

  it('keeps refQuery null for a prefix with too few digits (not a reference shape)', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('T-4'))
    expect(result.current.refQuery).toBeNull()
  })

  it('keeps the server-matched task visible: the predicate skips the free-text re-filter', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('T-00042'))
    // Without the ref branch this returns false (the number is in no text field),
    // so the single task the ?ref= lookup returned would vanish from the list.
    expect(result.current.matchesFilters(taskFoundByRef)).toBe(true)
  })

  it('still filters on free text when the query is NOT a reference number', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('factuur'))
    expect(result.current.matchesFilters(taskFoundByRef)).toBe(false)
    act(() => result.current.setQuery('bellen'))
    expect(result.current.matchesFilters(taskFoundByRef)).toBe(true)
  })

  it('counts a reference query as an active filter, so the clear-button shows', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('T-00042'))
    expect(result.current.anyFilterActive).toBe(true)
    act(() => result.current.clearAllFilters())
    expect(result.current.refQuery).toBeNull()
  })
})
