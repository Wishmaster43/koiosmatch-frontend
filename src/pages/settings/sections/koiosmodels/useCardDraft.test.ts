import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useCardDraft } from './useCardDraft'

describe('useCardDraft', () => {
  it('initializes with provided data and no dirty state', () => {
    const { result } = renderHook(() =>
      useCardDraft({ name: 'test' }, async () => ({}), (d, o) => d.name !== o.name),
    )
    expect(result.current.draft).toEqual({ name: 'test' })
    expect(result.current.dirty).toBe(false)
    expect(result.current.saving).toBe(false)
    expect(result.current.saved).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('detects dirty state when draft changes', () => {
    const { result } = renderHook(() =>
      useCardDraft({ name: 'test' }, async () => ({}), (d, o) => d.name !== o.name),
    )
    act(() => result.current.setDraft({ name: 'changed' }))
    expect(result.current.dirty).toBe(true)
  })

  it('calls onSave and onSuccess on successful save', async () => {
    const onSave = vi.fn(async () => ({ name: 'saved' }))
    const onSuccess = vi.fn()
    const { result } = renderHook(() =>
      useCardDraft({ name: 'test' }, onSave, (d, o) => d.name !== o.name, onSuccess),
    )
    act(() => result.current.setDraft({ name: 'changed' }))
    await act(() => result.current.save())
    expect(onSave).toHaveBeenCalledWith({ name: 'changed' })
    expect(onSuccess).toHaveBeenCalledWith({ name: 'saved' })
    expect(result.current.saved).toBe(true)
  })

  it('sets error on save failure', async () => {
    const onSave = vi.fn(async () => { throw new Error('API error') })
    const { result } = renderHook(() =>
      useCardDraft({ name: 'test' }, onSave, (d, o) => d.name !== o.name),
    )
    await act(() => result.current.save())
    expect(result.current.error).toBeTruthy()
    expect(result.current.saved).toBe(false)
  })
})
