/**
 * useCachedLookup — the shared fetch+cache+dedupe path every tenant-lookup hook
 * (useGenders, useFunctions, useNoteTypes, …) is built on had zero direct tests
 * before this file (audit item 8 follow-up). Covers: concurrent-mount dedupe onto
 * one GET, the cache-hit path on a later mount, the "mapFn returns null → keep the
 * fallback and don't cache" contract, invalidate() forcing a refetch, and the
 * settle-cleanup fix (98ce0b7b) — a failing fetch must never surface as an
 * unhandled promise rejection. Each test uses its OWN url so the module-scope
 * cache/inFlight maps never leak state between tests (no vi.resetModules needed).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import api from './api'
import { useCachedLookup } from './useCachedLookup'

// This project's tsconfig has no @types/node (browser-only lib/types); Node's real
// `process` global exists at test runtime regardless, so declare just the two
// methods this file needs rather than pulling @types/node in app-wide for one test.
declare const process: {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
}

// Only the default client is stubbed — no unwrap/unwrapList needed, this hook
// receives the raw axios response and hands it straight to the caller's mapFn.
vi.mock('./api', () => ({ default: { get: vi.fn() } }))
const mockedGet = vi.mocked(api.get)

// Simple mapFn used by most tests below: pulls `value` off the response body,
// returning null when absent (mirrors every real hook's "nothing usable" guard).
const mapValue = (res: AxiosResponse): string | null => (res.data as { value: string | null }).value ?? null

afterEach(() => vi.clearAllMocks())

describe('useCachedLookup', () => {
  // (a) Two mounts firing in the same tick must dedupe onto ONE in-flight GET —
  // the whole reason this hook exists (audit item 8: 5 components, 5 identical GETs).
  it('dedupes two concurrent mounts onto a single GET', async () => {
    const url = '/test-lookup-dedupe'
    mockedGet.mockResolvedValue({ data: { value: 'shared' } } as AxiosResponse)

    const { result: a } = renderHook(() => useCachedLookup(url, mapValue, 'fallback'))
    const { result: b } = renderHook(() => useCachedLookup(url, mapValue, 'fallback'))

    await waitFor(() => expect(a.current.data).toBe('shared'))
    await waitFor(() => expect(b.current.data).toBe('shared'))
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  // (b) Once the cache is warm, a later mount reads it synchronously — no loading
  // flash, no second network call.
  it('reuses the cache on a later mount after a successful fetch — no new GET', async () => {
    const url = '/test-lookup-cache-hit'
    mockedGet.mockResolvedValue({ data: { value: 'cached' } } as AxiosResponse)

    const first = renderHook(() => useCachedLookup(url, mapValue, 'fallback'))
    await waitFor(() => expect(first.result.current.data).toBe('cached'))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    // A brand-new mount of the same url, after the cache has already settled.
    const second = renderHook(() => useCachedLookup(url, mapValue, 'fallback'))
    expect(second.result.current.data).toBe('cached')
    expect(second.result.current.loading).toBe(false)
    expect(mockedGet).toHaveBeenCalledTimes(1) // still just the one GET from `first`
  })

  // (c) mapFn returning null means "nothing usable" — the fallback stays and the
  // response is deliberately NOT cached, so the next mount retries instead of
  // freezing an empty/bad response forever.
  it('a mapFn returning null keeps the fallback and does not cache — the next mount refetches', async () => {
    const url = '/test-lookup-null-map'
    mockedGet.mockResolvedValue({ data: { value: null } } as AxiosResponse)
    const mapNull = (): string | null => null

    const first = renderHook(() => useCachedLookup(url, mapNull, 'fallback'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(first.result.current.data).toBe('fallback')
    expect(mockedGet).toHaveBeenCalledTimes(1)

    // Nothing was cached for this url — a second mount fetches again.
    renderHook(() => useCachedLookup(url, mapNull, 'fallback'))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
  })

  // (d) Regression guard for 98ce0b7b: the settle-cleanup chain
  // (`request.finally(...).catch(() => {})`) must swallow a rejected fetch itself —
  // without it, a failed lookup surfaced as an unhandled promise rejection on top
  // of the per-consumer .catch() that keeps the fallback.
  it('a failing fetch keeps the fallback, ends loading, and never produces an unhandled rejection', async () => {
    const url = '/test-lookup-reject'
    mockedGet.mockRejectedValue(new Error('network down'))

    const rejectionSpy = vi.fn()
    process.on('unhandledRejection', rejectionSpy)
    try {
      const { result } = renderHook(() => useCachedLookup(url, mapValue, 'fallback'))
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.data).toBe('fallback')

      // Node reports an unhandled rejection asynchronously, after the microtask
      // queue drains — give it a real tick before asserting the spy stayed silent.
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(rejectionSpy).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', rejectionSpy)
    }
  })

  // (e) invalidate() deletes the cached entry — the next mount must treat it as a
  // fresh cache-miss and refetch rather than reusing the stale value.
  it('invalidate() forces the next mount to refetch', async () => {
    const url = '/test-lookup-invalidate'
    mockedGet.mockResolvedValue({ data: { value: 'v1' } } as AxiosResponse)

    const first = renderHook(() => useCachedLookup(url, mapValue, 'fallback'))
    await waitFor(() => expect(first.result.current.data).toBe('v1'))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    first.result.current.invalidate()
    mockedGet.mockResolvedValue({ data: { value: 'v2' } } as AxiosResponse)

    const second = renderHook(() => useCachedLookup(url, mapValue, 'fallback'))
    await waitFor(() => expect(second.result.current.data).toBe('v2'))
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })
})
