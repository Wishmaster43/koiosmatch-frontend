/**
 * useListFieldSetter — the shared setState-shaped wrapper over one field of a
 * react-query list cache entry. Asserts the identity contract call sites rely
 * on (a fresh queryKey/empty literal every render must NOT recreate the
 * setter — it would churn any caller's own useCallback deps), the actual
 * cache write via a real QueryClient, and that a re-render's LATEST
 * queryKey/empty (held in refs) is what a later call uses, never a stale one.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useListFieldSetter } from './useListFieldSetter'

interface Data { total: number; rows: string[] }

// One QueryClientProvider per test, since useListFieldSetter needs a live client.
// createElement (not JSX) keeps this a plain .ts file, matching every other
// hook test in this folder.
function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useListFieldSetter · identity', () => {
  it('keeps the SAME setter identity across a re-render even with a fresh queryKey array and empty object each time', () => {
    const queryClient = new QueryClient()
    const { result, rerender } = renderHook(
      () => useListFieldSetter<Data, 'total'>(['applications', 'list'], 'total', { total: 0, rows: [] }),
      { wrapper: makeWrapper(queryClient) },
    )
    const first = result.current
    // Every rerender below re-evaluates the factory, handing the hook a BRAND
    // NEW array/object literal — exactly what a real call site does.
    rerender()
    rerender()
    expect(result.current).toBe(first)
  })
})

describe('useListFieldSetter · cache writes', () => {
  it('writes the field into the query cache via a real QueryClient', () => {
    const queryClient = new QueryClient()
    const key = ['applications', 'list', 'b']
    queryClient.setQueryData<Data>(key, { total: 3, rows: ['x'] })
    const { result } = renderHook(
      () => useListFieldSetter<Data, 'total'>(key, 'total', { total: 0, rows: [] }),
      { wrapper: makeWrapper(queryClient) },
    )
    act(() => { result.current(9) })
    expect(queryClient.getQueryData<Data>(key)).toEqual({ total: 9, rows: ['x'] })
  })

  it('falls back to the empty default when nothing is cached yet', () => {
    const queryClient = new QueryClient()
    const key = ['applications', 'list', 'c']
    const { result } = renderHook(
      () => useListFieldSetter<Data, 'total'>(key, 'total', { total: 0, rows: [] }),
      { wrapper: makeWrapper(queryClient) },
    )
    act(() => { result.current(5) })
    expect(queryClient.getQueryData<Data>(key)).toEqual({ total: 5, rows: [] })
  })

  it('accepts an updater function reading the current field value', () => {
    const queryClient = new QueryClient()
    const key = ['applications', 'list', 'd']
    queryClient.setQueryData<Data>(key, { total: 3, rows: [] })
    const { result } = renderHook(
      () => useListFieldSetter<Data, 'total'>(key, 'total', { total: 0, rows: [] }),
      { wrapper: makeWrapper(queryClient) },
    )
    act(() => { result.current((prev) => prev + 1) })
    expect(queryClient.getQueryData<Data>(key)).toEqual({ total: 4, rows: [] })
  })
})

describe('useListFieldSetter · latest queryKey (refs, not a stale closure)', () => {
  it('writes to the LATEST queryKey after a re-render changes it, never the one from the first render', () => {
    const queryClient = new QueryClient()
    let key: readonly string[] = ['applications', 'list', 'e1']
    const { result, rerender } = renderHook(
      () => useListFieldSetter<Data, 'total'>(key, 'total', { total: 0, rows: [] }),
      { wrapper: makeWrapper(queryClient) },
    )
    key = ['applications', 'list', 'e2']
    rerender()
    act(() => { result.current(7) })
    expect(queryClient.getQueryData<Data>(['applications', 'list', 'e2'])).toEqual({ total: 7, rows: [] })
    expect(queryClient.getQueryData<Data>(['applications', 'list', 'e1'])).toBeUndefined()
  })
})
