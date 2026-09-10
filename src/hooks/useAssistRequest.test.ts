// Regression test for useAssistState: verifies the idle → loading → success/error
// transitions and that a calm-status (422) error carries the warning tone.
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAssistState } from './useAssistRequest'

const t = (key: string) => key

describe('useAssistState', () => {
  it('moves idle -> loading -> success and stores the mode + result', () => {
    const { result } = renderHook(() => useAssistState<{ text: string }, 'summarize'>({ t, fallback: 'oops' }))

    act(() => { result.current.startLoading('summarize') })
    expect(result.current.status).toBe('loading')
    expect(result.current.mode).toBe('summarize')

    act(() => { result.current.succeed({ text: 'done' }) })
    expect(result.current.status).toBe('success')
    expect(result.current.result).toEqual({ text: 'done' })
  })

  it('marks a 422 response as a calm warning, not a danger error', () => {
    const { result } = renderHook(() => useAssistState({ t, fallback: 'oops' }))

    act(() => { result.current.startLoading('x') })
    act(() => { result.current.fail({ response: { status: 422 } }) })

    expect(result.current.status).toBe('error')
    expect(result.current.tone).toBe('warning')
  })
})
