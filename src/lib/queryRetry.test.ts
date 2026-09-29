/**
 * queryRetry — a final error never retries; everything else follows the fallback policy.
 */
import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { retryUnless, clientRetry } from './queryRetry'

const isFinal = (err: unknown) => (err as { status?: number })?.status === 403
const FINAL = { status: 403 }
const OTHER = { status: 500 }

describe('retryUnless', () => {
  it('never retries a final error, whatever the fallback says', () => {
    expect(retryUnless(isFinal, 3)(0, FINAL)).toBe(false)
    expect(retryUnless(isFinal, true)(0, FINAL)).toBe(false)
    expect(retryUnless(isFinal, () => true)(0, FINAL)).toBe(false)
  })
  it('follows a numeric fallback for other errors', () => {
    const retry = retryUnless(isFinal, 2)
    expect(retry(0, OTHER)).toBe(true)
    expect(retry(1, OTHER)).toBe(true)
    expect(retry(2, OTHER)).toBe(false)
  })
  it('follows a boolean fallback for other errors', () => {
    expect(retryUnless(isFinal, false)(0, OTHER)).toBe(false)
    expect(retryUnless(isFinal, true)(5, OTHER)).toBe(true)
  })
  it('delegates to a function fallback with the same arguments', () => {
    const calls: Array<[number, unknown]> = []
    const retry = retryUnless(isFinal, (n, e) => { calls.push([n, e]); return n < 1 })
    expect(retry(0, OTHER)).toBe(true)
    expect(retry(1, OTHER)).toBe(false)
    expect(calls).toEqual([[0, OTHER], [1, OTHER]])
  })
  it('uses react-query\'s default of three retries when the client sets none', () => {
    const retry = retryUnless(isFinal, undefined)
    expect(retry(2, OTHER)).toBe(true)
    expect(retry(3, OTHER)).toBe(false)
  })
})

describe('clientRetry', () => {
  it('reads the client default (a test client with retry:false yields false; a bare client yields undefined)', () => {
    expect(clientRetry(new QueryClient({ defaultOptions: { queries: { retry: false } } }))).toBe(false)
    expect(clientRetry(new QueryClient())).toBeUndefined()
  })
})
