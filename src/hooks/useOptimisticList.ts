/**
 * useOptimisticList — the "load a list, then keep it in sync with optimistic
 * add/patch/drop" hook shared by settings' API-key and webhook-subscription
 * screens (useApiKeys/useWebhookSubscriptions used to hand-copy this). Keeps
 * the list state in one place so a container can switch between list and
 * detail views without refetching, while create/update/delete keep it in sync.
 */
import { useState, useEffect, useCallback } from 'react'

interface ListResponse<T> { rows?: T[] }

export function useOptimisticList<T extends { id: unknown }>(
  fetchList: () => Promise<ListResponse<T>>,
  // Some callers (API keys: a type PATCH can auto-demote a sibling's primary
  // flag server-side) need a full refetch after add/patch to correct drift the
  // optimistic update alone can't know about; others (webhooks) never do.
  { refetchOnAdd = false, refetchOnPatch = false }: { refetchOnAdd?: boolean; refetchOnPatch?: boolean } = {},
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetch (or refetch) the list, resetting the error/loading flags.
  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetchList()
      .then(res => setItems(res.rows ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [fetchList])

  useEffect(() => { load() }, [load])

  // Optimistic list helpers used by the list/detail views after a mutation.
  const add = (item: T) => { setItems(p => [item, ...p]); if (refetchOnAdd) load() }
  const patch = (id: unknown, data: Partial<T>) => { setItems(p => p.map(x => (x.id === id ? { ...x, ...data } : x))); if (refetchOnPatch) load() }
  const drop = (id: unknown) => setItems(p => p.filter(x => x.id !== id))

  return { items, loading, error, reload: load, add, patch, drop }
}
