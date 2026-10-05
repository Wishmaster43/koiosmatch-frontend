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

  it('ONIX N-005: surfaces an unmapped 422 key as a banner alongside the field flags, when a translate fn is passed', () => {
    const { result } = renderHook(() => useSubmitState())
    const err = { response: { data: { errors: { function_title: ['Required'], 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } } }
    const t = (key: string, opts?: Record<string, unknown>) => `${key}:${JSON.stringify(opts)}`

    act(() => { result.current.failWith(err, API_TO_FORM, 'Something went wrong', t) })

    expect(result.current.errors).toEqual({ func: true, 'custom_fields.vog': true })
    expect(result.current.submitErr).toBe('common:validation.fieldRequiredNamed:{"field":"vog"}')
  })

  it('without a translate fn, an unmapped 422 key sets field flags and falls back to the raw joined message', () => {
    const { result } = renderHook(() => useSubmitState())
    const err = { response: { data: { errors: { 'custom_fields.vog': ['Required'] } } } }

    act(() => { result.current.failWith(err, API_TO_FORM, 'Something went wrong') })

    expect(result.current.errors).toEqual({ 'custom_fields.vog': true })
    expect(result.current.submitErr).toBe('Required')
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
