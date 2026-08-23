/**
 * queryClient — pins the two defaults REFRESH-FIX-2 relies on: `staleTime`
 * stays 30s (so a focus refetch only fires when data has actually gone stale,
 * not on every tab switch), and `refetchOnWindowFocus` is ON (closes the
 * "edited elsewhere, still shows old here" class app-wide). A silent revert of
 * either would reopen the exact bug this fix closes.
 */
import { describe, it, expect } from 'vitest'
import { queryClient } from './queryClient'

describe('queryClient defaults', () => {
  it('refetches on window focus with a 30s staleTime', () => {
    const { staleTime, refetchOnWindowFocus } = queryClient.getDefaultOptions().queries ?? {}
    expect(refetchOnWindowFocus).toBe(true)
    expect(staleTime).toBe(30_000)
  })
})
