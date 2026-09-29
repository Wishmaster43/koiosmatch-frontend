/**
 * queryRetry — a react-query retry policy that keeps the client's OWN default for
 * ordinary failures and never retries an answer the caller knows is final
 * (INTERVIEW-403-1: a 403 is a role answer; retrying it is three more 403s).
 * Reading the policy off the client keeps a test's `retry: false` and the app's
 * default (src/lib/queryClient.ts) both in force — a hook-level `retry` would
 * silently override either.
 */
import type { QueryClient } from '@tanstack/react-query'

export type RetryValue = boolean | number | ((failureCount: number, error: unknown) => boolean) | undefined

// react-query's own default when the client sets none.
const DEFAULT_RETRIES = 3

// A retry function: false for a final error, else the fallback policy's verdict.
export function retryUnless(isFinal: (error: unknown) => boolean, fallback: RetryValue) {
  return (failureCount: number, error: unknown): boolean => {
    if (isFinal(error)) return false
    if (typeof fallback === 'function') return fallback(failureCount, error)
    if (typeof fallback === 'number') return failureCount < fallback
    if (typeof fallback === 'boolean') return fallback
    return failureCount < DEFAULT_RETRIES
  }
}

// The client's configured default retry policy (undefined when none is set).
export function clientRetry(client: QueryClient): RetryValue {
  return client.getDefaultOptions().queries?.retry as RetryValue
}
