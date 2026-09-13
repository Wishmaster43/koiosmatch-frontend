/**
 * runAliveGuarded — asserts the three outcomes every entity-keyed load effect
 * relies on (§9): a resolved promise calls onSuccess and clears loading, a
 * rejected one sets the error flag and clears loading, and an unmounted caller
 * (alive() === false) sees none of the setters fire.
 */
import { describe, it, expect, vi } from 'vitest'
import { runAliveGuarded } from './aliveGuard'

// Flushes the microtask queue past the internal .then/.catch/.finally chain
// (a single `await` on the original promise is not enough — that chain adds
// its own hops after it).
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('runAliveGuarded', () => {
  it('calls onSuccess with the result and clears loading on a resolved promise', async () => {
    const onSuccess = vi.fn()
    const setError = vi.fn()
    const setLoading = vi.fn()
    runAliveGuarded(Promise.resolve('ok'), () => true, onSuccess, setError, setLoading)
    await flush()
    expect(onSuccess).toHaveBeenCalledWith('ok')
    expect(setError).not.toHaveBeenCalled()
    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it('sets the error flag and clears loading on a rejected promise, without calling onSuccess', async () => {
    const onSuccess = vi.fn()
    const setError = vi.fn()
    const setLoading = vi.fn()
    runAliveGuarded(Promise.reject(new Error('boom')), () => true, onSuccess, setError, setLoading)
    await flush()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(setError).toHaveBeenCalledWith(true)
    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it('fires none of the setters once alive() is false, on either resolve or reject', async () => {
    const onSuccess = vi.fn()
    const setError = vi.fn()
    const setLoading = vi.fn()
    runAliveGuarded(Promise.resolve('ok'), () => false, onSuccess, setError, setLoading)
    runAliveGuarded(Promise.reject(new Error('boom')), () => false, onSuccess, setError, setLoading)
    await flush()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(setError).not.toHaveBeenCalled()
    expect(setLoading).not.toHaveBeenCalled()
  })
})
