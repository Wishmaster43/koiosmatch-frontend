/**
 * useReportSwitch — pure hash helpers + the hook's URL sync (RAPPORTEN-CONSOLIDATIE-1).
 * Mirrors useDrawerUrl.test.tsx's own coverage shape: pure functions first, then
 * the hook wired to a real window.location.hash.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getViewFromHash, setViewInHash, useReportSwitch } from './useReportSwitch'

describe('getViewFromHash / setViewInHash (pure)', () => {
  it('reads null when there is no query string at all', () => {
    expect(getViewFromHash('#reports.candidates')).toBeNull()
  })

  it('reads the view param alongside other query params', () => {
    expect(getViewFromHash('#reports.candidates?view=leads&open=42')).toBe('leads')
  })

  it('writes the view param, keeping the page path untouched', () => {
    expect(setViewInHash('#reports.candidates', 'leads')).toBe('#reports.candidates?view=leads')
  })

  it('writes alongside an existing query param without disturbing it', () => {
    expect(setViewInHash('#reports.candidates?open=42', 'leads')).toBe('#reports.candidates?open=42&view=leads')
  })

  it('clears the view param (null) back to a bare path', () => {
    expect(setViewInHash('#reports.candidates?view=leads', null)).toBe('#reports.candidates')
  })
})

describe('useReportSwitch (hook, real hash)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#reports.candidates')
  })

  it('defaults to the caller-supplied initial position when the URL carries none', () => {
    const { result } = renderHook(() => useReportSwitch(['candidates', 'leads'], 'candidates'))
    expect(result.current[0]).toBe('candidates')
  })

  it('a `?view=` already in the URL wins over the caller default (a pasted deep link is never overridden)', () => {
    window.history.replaceState(null, '', '#reports.candidates?view=leads')
    const { result } = renderHook(() => useReportSwitch(['candidates', 'leads'], 'candidates'))
    expect(result.current[0]).toBe('leads')
  })

  it('flipping the switch updates state AND replaces the URL — never pushes a new history entry', () => {
    const before = window.history.length
    const { result } = renderHook(() => useReportSwitch(['candidates', 'leads'], 'candidates'))
    act(() => { result.current[1]('leads') })
    expect(result.current[0]).toBe('leads')
    expect(window.location.hash).toBe('#reports.candidates?view=leads')
    expect(window.history.length).toBe(before) // replaceState, not pushState
  })

  it('re-seeds when the caller\'s initial position changes without an unmount (legacy alias → canonical route)', () => {
    const { result, rerender } = renderHook(
      ({ initial }: { initial: string }) => useReportSwitch(['candidates', 'leads'], initial),
      { initialProps: { initial: 'leads' } },
    )
    expect(result.current[0]).toBe('leads')
    rerender({ initial: 'candidates' })
    expect(result.current[0]).toBe('candidates')
  })
})
