/**
 * useTaskFilters — NUMMER-1 reference-number detection. Typing T-00042 must flip
 * the header search from the client-side free-text filter to an exact server-side
 * `?ref=` lookup (TaskQuery returns early on `ref`), and the row predicate must
 * then STOP re-filtering on that text — otherwise the one task the server just
 * found is filtered straight back out, because the predicate never reads the
 * reference number. J013-SEARCH-1 (J4): anything that is not a reference number is
 * exposed as `searchQuery` for the server's `?q=` search, and the predicate no longer
 * re-filters on text at all — a server match on a linked name would otherwise vanish.
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

  // J013-SEARCH-1 (J4): the free-text term is a SERVER search now, so the predicate
  // keeps every row the server returned — a task found on its linked candidate's
  // name has none of that text in title/description/assignee.
  it('does not re-filter on free text: the server already narrowed the fetch via ?q=', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('factuur'))
    expect(result.current.matchesFilters(taskFoundByRef)).toBe(true)
    act(() => result.current.setQuery('Lotte Bakker'))
    expect(result.current.matchesFilters(taskFoundByRef)).toBe(true)
  })

  it('exposes the trimmed free text as searchQuery for the fetch and keeps refQuery null', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('  Lotte Bakker  '))
    expect(result.current.searchQuery).toBe('Lotte Bakker')
    expect(result.current.refQuery).toBeNull()
  })

  it('keeps searchQuery null for a reference number (one server shape per typed value) and for a blank box', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('T-00042'))
    expect(result.current.searchQuery).toBeNull()
    act(() => result.current.setQuery('   '))
    expect(result.current.searchQuery).toBeNull()
  })

  it('caps searchQuery at the backend\'s 255-character limit so a pasted wall of text never earns a 422', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('x'.repeat(300)))
    expect(result.current.searchQuery).toHaveLength(255)
  })

  it('counts a reference query as an active filter, so the clear-button shows', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setQuery('T-00042'))
    expect(result.current.anyFilterActive).toBe(true)
    act(() => result.current.clearAllFilters())
    expect(result.current.refQuery).toBeNull()
  })
})

describe('useTaskFilters · KPI-RIJ-9-1 "unassigned" tile', () => {
  it('matches only an open task with no assignee, no team AND no role', () => {
    const { result } = renderHook(() => useTaskFilters())
    act(() => result.current.setKpiFilter('unassigned'))
    expect(result.current.matchesFilters({ statusIsDone: false, assignee: null, team: null })).toBe(true)
    expect(result.current.matchesFilters({ statusIsDone: false, assignee: { name: 'Nora' }, team: null })).toBe(false)
    expect(result.current.matchesFilters({ statusIsDone: false, assignee: null, team: { name: 'Backoffice' } })).toBe(false)
    expect(result.current.matchesFilters({ statusIsDone: true, assignee: null, team: null })).toBe(false)
    // TAAK-ROL-1 verifier fix: a role-assigned open task must not count as unassigned.
    expect(result.current.matchesFilters({ statusIsDone: false, assignee: null, team: null, assigneeRole: { name: 'Recruiter' } })).toBe(false)
    act(() => result.current.setKpiFilter(null))
  })
})
