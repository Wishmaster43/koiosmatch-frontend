/**
 * useAuthRequest.test — begin() primes CSRF and clears a running countdown; a failed prime never throws.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const prime = vi.fn()
vi.mock('@/lib/api', () => ({ primeCsrf: () => prime() }))

import { useAuthRequest } from './useAuthRequest'

describe('useAuthRequest', () => {
  it('primes CSRF and clears the countdown', async () => {
    prime.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useAuthRequest())
    act(() => result.current.countdown.start(5))
    expect(result.current.countdown.active).toBe(true)
    await act(async () => { await result.current.begin() })
    expect(prime).toHaveBeenCalledTimes(1)
    expect(result.current.countdown.active).toBe(false)
  })

  it('swallows a failed prime', async () => {
    prime.mockRejectedValueOnce(new Error('net'))
    const { result } = renderHook(() => useAuthRequest())
    await expect(act(async () => { await result.current.begin() })).resolves.toBeUndefined()
  })
})
