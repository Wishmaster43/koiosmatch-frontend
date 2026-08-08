/**
 * useLiveFieldValidation tests — the generic touched/message state machine in
 * isolation (no host component), mirroring the coverage the candidate create
 * form's own copy already had before this hook was generalised.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLiveFieldValidation } from './useLiveFieldValidation'

// i18next is not initialised in this test — a plain passthrough stands in for
// the real TFunction, mirroring how the app's own translated key resolves to
// its raw key string when a locale bundle has nothing to say.
const t = ((k: string) => k) as unknown as Parameters<typeof useLiveFieldValidation>[1]

interface Form { email: string; name: string }
const isValidEmail = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const validators = { email: isValidEmail }
const errorKeys = { email: 'validation.emailFormat' }

describe('useLiveFieldValidation', () => {
  it('renders no message before the field is touched, even when malformed', () => {
    const form: Form = { email: 'not-an-email', name: '' }
    const { result } = renderHook(() => useLiveFieldValidation(form, t, validators, errorKeys))
    expect(result.current.fieldMessage('email')).toBeUndefined()
    expect(result.current.hasFormatError).toBe(true)
  })

  it('renders the live format message once the field is marked touched', () => {
    const form: Form = { email: 'not-an-email', name: '' }
    const { result } = renderHook(() => useLiveFieldValidation(form, t, validators, errorKeys))
    act(() => result.current.markTouched('email'))
    expect(result.current.fieldMessage('email')).toBe('validation.emailFormat')
  })

  it('a server 422 message always wins over the live format check', () => {
    const form: Form = { email: 'not-an-email', name: '' }
    const { result, rerender } = renderHook(
      ({ f }: { f: Form }) => useLiveFieldValidation(f, t, validators, errorKeys),
      { initialProps: { f: form } },
    )
    act(() => result.current.markTouched('email'))
    act(() => result.current.setFieldMessages({ email: 'Dit e-mailadres is al in gebruik.' }))
    rerender({ f: form })
    expect(result.current.fieldMessage('email')).toBe('Dit e-mailadres is al in gebruik.')
  })

  it('clearFieldMessage drops a server message so a live check can take over again', () => {
    const form: Form = { email: 'not-an-email', name: '' }
    const { result, rerender } = renderHook(
      ({ f }: { f: Form }) => useLiveFieldValidation(f, t, validators, errorKeys),
      { initialProps: { f: form } },
    )
    act(() => result.current.setFieldMessages({ email: 'Dit e-mailadres is al in gebruik.' }))
    act(() => result.current.markTouched('email'))
    rerender({ f: form })
    act(() => result.current.clearFieldMessage('email'))
    rerender({ f: form })
    expect(result.current.fieldMessage('email')).toBe('validation.emailFormat')
  })

  it('touchInvalidFields marks every malformed field touched and returns its keys', () => {
    const form: Form = { email: 'not-an-email', name: '' }
    const { result } = renderHook(() => useLiveFieldValidation(form, t, validators, errorKeys))
    let invalid: Array<keyof Form> = []
    act(() => { invalid = result.current.touchInvalidFields() })
    expect(invalid).toEqual(['email'])
    expect(result.current.fieldMessage('email')).toBe('validation.emailFormat')
  })

  it('hasFormatError is false once the value is well-formed', () => {
    const form: Form = { email: 'jan@example.nl', name: '' }
    const { result } = renderHook(() => useLiveFieldValidation(form, t, validators, errorKeys))
    expect(result.current.hasFormatError).toBe(false)
    expect(result.current.touchInvalidFields()).toEqual([])
  })

  it('a field with no registered validator never gains a format error', () => {
    const form: Form = { email: '', name: 'anything at all' }
    const { result } = renderHook(() => useLiveFieldValidation(form, t, validators, errorKeys))
    act(() => result.current.markTouched('name'))
    expect(result.current.fieldMessage('name')).toBeUndefined()
    expect(result.current.hasFormatError).toBe(false)
  })
})
