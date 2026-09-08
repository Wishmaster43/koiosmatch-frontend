/**
 * useCreateForm — shared create-form state hook (ApiKeyCreate + WebhookCreate).
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCreateForm } from './useCreateForm'

describe('useCreateForm', () => {
  it('initializes with idle state (not saving, no error, no result)', () => {
    const { result } = renderHook(() => useCreateForm<{ secret: string }>())
    expect(result.current.saving).toBe(false)
    expect(result.current.error).toBe(false)
    expect(result.current.result).toBeNull()
  })

  it('transitions through save → success flow', () => {
    const { result: hook } = renderHook(() => useCreateForm<{ id: string; secret: string }>())
    const mockCreated = { id: '123', secret: 'abc' }

    act(() => {
      hook.current.setSaving(true)
    })
    expect(hook.current.saving).toBe(true)

    act(() => {
      hook.current.setResult(mockCreated)
      hook.current.setSaving(false)
    })
    expect(hook.current.saving).toBe(false)
    expect(hook.current.result).toEqual(mockCreated)
    expect(hook.current.error).toBe(false)
  })

  it('transitions through save → error flow', () => {
    const { result: hook } = renderHook(() => useCreateForm<{ secret: string }>())

    act(() => {
      hook.current.setSaving(true)
    })

    act(() => {
      hook.current.setError(true)
      hook.current.setSaving(false)
    })
    expect(hook.current.saving).toBe(false)
    expect(hook.current.error).toBe(true)
    expect(hook.current.result).toBeNull()
  })
})
