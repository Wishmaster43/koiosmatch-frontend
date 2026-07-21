/**
 * useApplicationFilters — server filterParams (F-6). Focused on the
 * include_archived/bucket wiring: the "Gearchiveerd" quick-view must ask the
 * server to REVEAL detached rows (?include_archived=1) and must not be
 * narrowed by the bucket param while doing so (matchesFilters isolates the
 * archived view client-side instead, see the hook's own header comment).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

// usePageMemory persists in a module-level Map keyed by string, so a real
// import would leak filter state across the `it()`s in this file (unrelated
// to the behaviour under test) — stub it as a plain useState, same contract.
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_key: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))

import { useApplicationFilters } from './useApplicationFilters'

describe('useApplicationFilters — server filterParams', () => {
  it('sends no include_archived by default', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.filterParams.include_archived).toBeUndefined()
    expect(result.current.bucketParam).toBe('active')
  })

  it('sends include_archived=1 once the archived quick-view is toggled on', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setShowArchived(true) })
    expect(result.current.filterParams.include_archived).toBe(1)
  })

  it('drops the bucket param while showArchived is on (the reveal must not be narrowed by it)', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setShowArchived(true) })
    expect(result.current.bucketParam).toBeUndefined()
  })

  it('matchesFilters isolates the archived rows client-side once showArchived is on', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setShowArchived(true) })
    expect(result.current.matchesFilters({ archived: true, bucket: 'active' })).toBe(true)
    expect(result.current.matchesFilters({ archived: false, bucket: 'active' })).toBe(false)
  })

  it('hides archived rows from the default (non-archived) view', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.matchesFilters({ archived: true, bucket: 'active' })).toBe(false)
  })
})

// INTERVIEW-PHASE-1: the v1 "In interview" quick-view sends the server's own
// universal category filter (busy/completed/disqualified/none) directly.
describe('useApplicationFilters — interview quick-view (INTERVIEW-PHASE-1)', () => {
  it('sends no interview_status by default', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.filterParams.interview_status).toBeUndefined()
  })

  it('sends interview_status=busy once the quick-view is toggled on', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setInterviewBusy(true) })
    expect(result.current.filterParams.interview_status).toBe('busy')
  })

  it('flips anyFilterActive on, and clearAllFilters resets it', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setInterviewBusy(true) })
    expect(result.current.anyFilterActive).toBe(true)
    act(() => { result.current.clearAllFilters() })
    expect(result.current.interviewBusy).toBe(false)
    expect(result.current.filterParams.interview_status).toBeUndefined()
  })
})
