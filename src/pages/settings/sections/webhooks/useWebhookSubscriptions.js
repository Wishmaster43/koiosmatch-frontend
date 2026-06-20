/**
 * useWebhookSubscriptions — loads the outgoing-webhook list and exposes optimistic
 * list mutations, mirroring useApiKeys so the list/detail views stay in sync.
 */
import { useState, useEffect, useCallback } from 'react'
import { listSubscriptions } from './webhooksApi'

export function useWebhookSubscriptions() {
  const [subs, setSubs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  // Fetch (or refetch) the list, resetting the error/loading flags.
  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    listSubscriptions()
      .then((res) => setSubs(res.rows ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Optimistic list helpers used after a create / update / delete.
  const add   = (sub)      => setSubs((p) => [sub, ...p])
  const patch = (id, data) => setSubs((p) => p.map((s) => (s.id === id ? { ...s, ...data } : s)))
  const drop  = (id)       => setSubs((p) => p.filter((s) => s.id !== id))

  return { subs, loading, error, reload: load, add, patch, drop }
}
