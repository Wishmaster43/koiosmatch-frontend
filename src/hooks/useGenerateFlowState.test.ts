/**
 * useGenerateFlowState — asserts the open/status/concept/errorKey quartet and
 * its reset semantics: opening/closing always resets to a fresh idle state
 * (no stale concept/error leaking into the next run), while discard resets
 * without touching `open` — the exact behaviour both former hooks
 * (useProfileGenerate, useGenerateDescription) shared.
 */
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGenerateFlowState } from './useGenerateFlowState'

type Status = 'idle' | 'loading' | 'success' | 'error'

describe('useGenerateFlowState', () => {
  it('starts closed and idle, with an empty concept and no error', () => {
    const { result } = renderHook(() => useGenerateFlowState<Status>('idle'))
    expect(result.current.open).toBe(false)
    expect(result.current.status).toBe('idle')
    expect(result.current.concept).toBe('')
    expect(result.current.errorKey).toBeNull()
  })

  it('openFlow opens the flow and resets a previous run', () => {
    const { result } = renderHook(() => useGenerateFlowState<Status>('idle'))
    act(() => { result.current.setStatus('success'); result.current.setConcept('previous text') })

    act(() => { result.current.openFlow() })

    expect(result.current.open).toBe(true)
    expect(result.current.status).toBe('idle')
    expect(result.current.concept).toBe('')
    expect(result.current.errorKey).toBeNull()
  })

  it('closeFlow closes the flow and resets it the same way', () => {
    const { result } = renderHook(() => useGenerateFlowState<Status>('idle'))
    act(() => { result.current.openFlow() })
    act(() => { result.current.setStatus('error'); result.current.setErrorKey('errors.koiosUnavailable') })

    act(() => { result.current.closeFlow() })

    expect(result.current.open).toBe(false)
    expect(result.current.status).toBe('idle')
    expect(result.current.errorKey).toBeNull()
  })

  it('discard resets the concept/status/error but leaves the flow open to regenerate', () => {
    const { result } = renderHook(() => useGenerateFlowState<Status>('idle'))
    act(() => { result.current.openFlow() })
    act(() => { result.current.setStatus('success'); result.current.setConcept('a concept') })

    act(() => { result.current.discard() })

    expect(result.current.open).toBe(true)
    expect(result.current.status).toBe('idle')
    expect(result.current.concept).toBe('')
  })
})
