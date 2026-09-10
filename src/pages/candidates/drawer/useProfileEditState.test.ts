/**
 * useProfileEditState — the pencil/draft/error state shared by the Profile
 * Address/Contact/Personal sub-tabs (DRY round 11, CANDTABS). Asserts the
 * setF/error-clear behaviour and the autoEditSignal ratchet (must open edit
 * mode on the SAME render as the signal change, never one render later).
 */
import { act, renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useProfileEditState } from './useProfileEditState'

// Mirrors the real sub-tabs' own `Record<Key, string>` form shape (a plain
// interface does not satisfy the hook's Record<string, string> constraint).
type TestForm = Record<'a' | 'b', string>
const emptyForm = (): TestForm => ({ a: '', b: '' })

describe('useProfileEditState', () => {
  it('starts closed, with the empty form and no errors', () => {
    const { result } = renderHook(() => useProfileEditState<TestForm, keyof TestForm & string>(emptyForm))
    expect(result.current.editing).toBe(false)
    expect(result.current.form).toEqual({ a: '', b: '' })
    expect(result.current.errors).toEqual({})
  })

  it('setF updates one field and clears its own error flag', () => {
    const { result } = renderHook(() => useProfileEditState<TestForm, keyof TestForm & string>(emptyForm))
    act(() => result.current.setErrors({ a: true }))
    act(() => result.current.setF('a', 'x'))
    expect(result.current.form.a).toBe('x')
    expect(result.current.errors.a).toBe(false)
  })

  it('opens edit mode on the SAME render the parent bumps autoEditSignal (never one render late)', () => {
    const { result, rerender } = renderHook(
      ({ signal }: { signal?: number }) => useProfileEditState<TestForm, keyof TestForm & string>(emptyForm, signal),
      { initialProps: { signal: 0 } },
    )
    expect(result.current.editing).toBe(false)
    rerender({ signal: 1 })
    expect(result.current.editing).toBe(true)
  })

  it('does not reopen on a re-render that keeps the same autoEditSignal', () => {
    const { result, rerender } = renderHook(
      ({ signal }: { signal?: number }) => useProfileEditState<TestForm, keyof TestForm & string>(emptyForm, signal),
      { initialProps: { signal: 1 } },
    )
    act(() => result.current.setEditing(false))
    rerender({ signal: 1 })
    expect(result.current.editing).toBe(false)
  })
})
