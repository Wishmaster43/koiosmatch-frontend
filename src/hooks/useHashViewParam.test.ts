import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHashViewParam } from './useHashViewParam'

afterEach(() => { window.location.hash = '' })

describe('useHashViewParam', () => {
  it('reads the initial value and follows hashchange events', () => {
    window.location.hash = '#settings/x'
    const { result } = renderHook(() => useHashViewParam('view'))
    expect(result.current).toBeNull()
    act(() => {
      window.location.hash = '#settings/x?view=queue'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current).toBe('queue')
  })

  it('starts from the value already present on mount', () => {
    window.location.hash = '#settings/x?view=queue'
    const { result } = renderHook(() => useHashViewParam('view'))
    expect(result.current).toBe('queue')
  })
})
