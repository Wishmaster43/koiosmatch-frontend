import { useEffect, useRef, useState } from 'react'

/**
 * SELECT-RACE-1 (REFRESH-FIX-2, Opus F2 + B1): bump a counter only when the SETTLED row-id set
 * changes — a same-ids refetch or local write never wipes a bulk selection; rows leaving the page do.
 *
 * On every SETTLED render (not mid-fetch — with placeholderData the in-flight render still shows
 * the previous rows) compare the row-id signature with the last settled one and bump the epoch
 * only when it differs. The first settled render merely SEEDS the signature (nothing is selectable
 * before rows land) — so a warm-cache mount, a same-ids refetch (cache invalidation after a field
 * edit, a window-focus refetch) and a SAME-IDS local setQueryData write (a bulk field edit) never
 * wipe the bulk selection; a local write that changes the id set (rows archived away, a created
 * row prepended) and Danny's race (a filtered response replacing the rows) do — rows that left the
 * page cannot stay selected.
 */
export function useRowsEpoch(isFetching: boolean, rows: ReadonlyArray<{ id?: unknown }> | undefined): number {
  const lastRowIdsRef = useRef<string | null>(null)
  const [rowsEpoch, setRowsEpoch] = useState(0)

  // Bumps the epoch only when the settled row-id set actually changed (see the comment above) —
  // the signal the caller uses to know it must drop bulk selection.
  useEffect(() => {
    if (isFetching) return
    const sig = (rows ?? []).map(r => String(r.id)).join('|')
    if (lastRowIdsRef.current !== null && sig !== lastRowIdsRef.current) setRowsEpoch(e => e + 1)
    lastRowIdsRef.current = sig
  }, [isFetching, rows])

  return rowsEpoch
}
