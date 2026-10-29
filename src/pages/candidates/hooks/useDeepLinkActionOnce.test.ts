import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useDeepLinkActionOnce } from './useDeepLinkActionOnce'

const link = { tab: 'communication', action: 'start' }

describe('useDeepLinkActionOnce', () => {
  it('returns the action on first open', () => {
    const { result } = renderHook(() => useDeepLinkActionOnce(link, 'communication:conversations:start'))
    expect(result.current.initialAction).toBe('start')
  })

  it('is undefined after consumption for the same initialTab', () => {
    const { result } = renderHook(() => useDeepLinkActionOnce(link, 'a'))
    act(() => result.current.onInitialActionConsumed())
    expect(result.current.initialAction).toBeUndefined()
  })

  it('returns again when initialTab changes', () => {
    const { result, rerender } = renderHook(({ t }) => useDeepLinkActionOnce(link, t), { initialProps: { t: 'a' } })
    act(() => result.current.onInitialActionConsumed())
    rerender({ t: 'b' })
    expect(result.current.initialAction).toBe('start')
  })

  it('is undefined when the deep link is not the communication tab', () => {
    const { result } = renderHook(() => useDeepLinkActionOnce({ tab: 'work', action: 'start' }, 'a'))
    expect(result.current.initialAction).toBeUndefined()
  })

  it('forgets the consumed action when the resetKey (record id) changes', () => {
    const { result, rerender } = renderHook(({ k }) => useDeepLinkActionOnce(link, 'a', k), { initialProps: { k: 'c1' } })
    act(() => result.current.onInitialActionConsumed())
    expect(result.current.initialAction).toBeUndefined()
    rerender({ k: 'c2' })
    expect(result.current.initialAction).toBe('start')
  })
})
