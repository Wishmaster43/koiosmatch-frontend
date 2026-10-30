import { useState, useEffect, useRef } from 'react'
import api, { unwrap, unwrapList } from '@/lib/api'

// Loads a tenant lookup endpoint into typed options, with the alive-guard + error/retry
// state every workflow lookup field repeats (LookupSelectField, WhatsappPhoneNumberField).
// `mapRow` shapes each raw row into the caller's option type (or null to drop it);
// `responseKey` reads one collection out of an object response instead of a plain list.
export function useLookupOptions<T>(
  endpoint: string,
  mapRow: (row: Record<string, unknown>) => T | null,
  extraDeps: unknown[] = [],
  responseKey?: string,
) {
  const [opts, setOpts] = useState<T[]>([])
  // A failed load must read as an error, never as an honestly-empty lookup (R8/§3 four states).
  const [error, setError] = useState(false)
  // A pending load must read as loading, never as an honestly-empty lookup (D8/§3 four states).
  const [loading, setLoading] = useState(true)
  const [retryTick, setRetryTick] = useState(0)

  // mapRow is a fresh closure each render by design (it captures per-render config); a ref
  // keeps the effect below reading the LATEST mapper without re-fetching on every render.
  // Refs update in an effect, never during render (react-hooks/refs).
  const mapRowRef = useRef(mapRow)
  useEffect(() => { mapRowRef.current = mapRow })
  // A primitive join of the caller's extra deps — avoids a spread element in the effect's
  // own dependency array (react-hooks/exhaustive-deps can't statically check a spread).
  // NUL as the separator so two deps can never merge into one key; written as an escape, never a raw byte in the file.
  const extraDepsKey = extraDeps.join('\0')

  useEffect(() => {
    if (!endpoint) return
    let alive = true
    setError(false)
    setLoading(true)
    // A static client import: the former dynamic import() split nothing (the module is already in the
    // graph through unwrap/unwrapList) and escaped vi.mock('@/lib/api') in the config-panel tests. The call
    // is deferred into the chain so a client that throws synchronously (a partial test mock without `get`)
    // lands in the error state exactly as the import() timing did, never as an uncaught error in the effect.
    Promise.resolve()
      .then(() => api.get(endpoint))
      .then(r => {
        const rows = (responseKey
          ? ((unwrap(r) as Record<string, unknown> | null)?.[responseKey] ?? [])
          : unwrapList(r).rows) as Array<Record<string, unknown>>
        if (alive) setOpts(rows.map(mapRowRef.current).filter((o): o is T => o !== null))
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // Only endpoint/responseKey/retry/caller-supplied extraDeps re-trigger the fetch.
  }, [endpoint, responseKey, retryTick, extraDepsKey])

  return { opts, error, loading, retry: () => setRetryTick(n => n + 1) }
}
