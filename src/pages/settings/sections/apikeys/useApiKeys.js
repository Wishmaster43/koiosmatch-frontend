/**
 * useApiKeys — loads the key list and exposes optimistic list mutations.
 *
 * Keeps the list state in one place so the container can switch between list and
 * detail without refetching, while create/update/delete keep the table in sync.
 */
import { useState, useEffect, useCallback } from 'react'
import { listApiKeys } from './apiKeysApi'

export function useApiKeys() {
  const [keys, setKeys]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  // Fetch (or refetch) the list, resetting the error/loading flags.
  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    listApiKeys()
      .then((res) => setKeys(res.rows ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Optimistic list helpers used by the list/detail views after a mutation.
  const add   = (key)        => setKeys((p) => [key, ...p])
  const patch = (id, data)   => setKeys((p) => p.map((k) => (k.id === id ? { ...k, ...data } : k)))
  const drop  = (id)         => setKeys((p) => p.filter((k) => k.id !== id))

  return { keys, loading, error, reload: load, add, patch, drop }
}
