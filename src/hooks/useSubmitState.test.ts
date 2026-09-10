/**
 * useSubmitState — asserts the saving/errors/submitErr trio and the failWith
 * branching (422 bag → field errors, anything else → the fallback banner),
 * the exact behaviour both former inline catch blocks had (useMatchSubmit,
 * usePlanIntakeForm).
 */
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSubmitState } from './useSubmitState'

const API_TO_FORM = { function_title: 'func', start_date: 'startDate' }

describe('useSubmitState', () => {
  it('maps a 422 validation bag onto field errors via the given apiToForm map', () => {
    const { result } = renderHook(() => useSubmitState())
    const err = { response: { data: { errors: { function_title: ['Required'], unknown_key: ['Bad'] } } } }

    act(() => { result.current.failWith(err, API_TO_FORM, 'Something went wrong') })

    expect(result.current.errors).toEqual({ func: true, unknown_key: true })
    expect(result.current.submitErr).toBeNull()
  })

  it('treats an EMPTY validation bag the same as a non-empty one — field errors, no banner', () => {
    const { result } = renderHook(() => useSubmitState())
    const err = { response: { data: { errors: {} } } }

    act(() => { result.current.failWith(err, API_TO_FORM, 'Something went wrong') })

    expect(result.current.errors).toEqual({})
    expect(result.current.submitErr).toBeNull()
  })

  it('falls back to the generic/server message when the error carries no bag at all', () => {
    const { result } = renderHook(() => useSubmitState())
    const err = { response: { data: { message: 'Server says no' } } }

    act(() => { result.current.failWith(err, API_TO_FORM, 'Something went wrong') })

    expect(result.current.errors).toEqual({})
    expect(result.current.submitErr).toBe('Server says no')
  })

  it('resetErrors clears both channels right before a submit attempt', () => {
    const { result } = renderHook(() => useSubmitState())
    act(() => { result.current.failWith({ response: { data: { message: 'x' } } }, API_TO_FORM, 'fallback') })
    expect(result.current.submitErr).toBe('x')

    act(() => { result.current.resetErrors() })

    expect(result.current.errors).toEqual({})
    expect(result.current.submitErr).toBeNull()
  })
})
