import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKoiosBridge } from './useKoiosBridge'
import { ASK_KOIOS_EVENT, type AskKoiosDetail } from '@/lib/koiosBridge'

// Fires the shared ask event with the given detail.
const ask = (detail: AskKoiosDetail) => act(() => { window.dispatchEvent(new CustomEvent(ASK_KOIOS_EVENT, { detail })) })

describe('useKoiosBridge', () => {
  it('opens the panel and stores question + ref on an ask event', () => {
    const { result } = renderHook(() => useKoiosBridge())
    expect(result.current.koiosOpen).toBe(false)
    const ref = { type: 'candidate', id: 'c1', label: 'Candidate 1' }
    ask({ text: 'Who fits?', ref })
    expect(result.current.koiosOpen).toBe(true)
    expect(result.current.koiosQuestion).toBe('Who fits?')
    expect(result.current.koiosContextRef).toEqual(ref)
  })

  it('ignores an event without text', () => {
    const { result } = renderHook(() => useKoiosBridge())
    ask({ text: '' })
    expect(result.current.koiosOpen).toBe(false)
    expect(result.current.koiosQuestion).toBeNull()
  })
})
