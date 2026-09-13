/**
 * useListFieldSetter — the setState-shaped wrapper every entity list hook
 * (customers/vacancies/candidates/applications) needs over one field of its
 * paginated React Query cache entry, so a container's optimistic mutations
 * (create/update/delete a row, adjust the total) keep working against the same
 * cache the list query itself reads. One generic hook instead of one hand-rolled
 * copy per entity.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

// Returns a Dispatch<SetStateAction<TValue>> that reads/writes `field` on the
// cached TData object at `queryKey`, falling back to `empty` when nothing is
// cached yet (e.g. a mutation fires before the first fetch settles). `queryKey`
// and `empty` are held in refs (updated on every render) rather than useCallback
// deps: both arrive as a fresh array/object literal from call sites, and the
// callback only ever needs their CURRENT value at call time — putting them in
// deps would recreate the setter (and churn any caller's own useCallback deps)
// on every render even though nothing the setter does actually changed.
export function useListFieldSetter<TData extends object, K extends keyof TData>(
  queryKey: QueryKey,
  field: K,
  empty: TData,
): Dispatch<SetStateAction<TData[K]>> {
  const queryClient = useQueryClient()
  const queryKeyRef = useRef(queryKey)
  const emptyRef = useRef(empty)
  // Refs are updated in an effect (not during render) so react-hooks/refs stays
  // happy; the callback below only ever reads them later, from an event handler.
  useEffect(() => {
    queryKeyRef.current = queryKey
    emptyRef.current = empty
  })
  return useCallback<Dispatch<SetStateAction<TData[K]>>>(updater => {
    queryClient.setQueryData<TData>(queryKeyRef.current, prev => {
      const cur = prev ?? emptyRef.current
      const nextValue = typeof updater === 'function'
        ? (updater as (p: TData[K]) => TData[K])(cur[field])
        : updater
      return { ...cur, [field]: nextValue }
    })
  }, [queryClient, field])
}
