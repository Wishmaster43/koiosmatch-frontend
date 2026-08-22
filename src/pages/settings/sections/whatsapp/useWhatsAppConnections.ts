/**
 * useWhatsAppConnections — loads the tenant's WhatsApp connections (WA-VESTIGING-FE-1,
 * GET /whatsapp). A tenant now holds MULTIPLE tokens, each scoped to everyone/a branch/
 * a role, so this one hook backs both the connection-management list and the numbers/
 * templates tabs (which need to pick WHICH connection they view). `reload` re-fetches
 * the whole list — used after promoting a default, since the backend demotes every
 * sibling row in one transaction and hand-reconciling that locally would just be a
 * second, driftable copy of the same server-enforced invariant (WA-SCOPE-1).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

export interface UseWhatsAppConnectionsResult {
  connections: WhatsappConnectionRow[]
  loading: boolean
  error: boolean
  // Re-fetch the whole list from the server — used after create/edit (a save can
  // silently flip status via its own check-status call) and after promoting a
  // default (the backend demotes every sibling row in one transaction), never
  // hand-reconciled locally.
  reload: () => Promise<void>
  // Drop one row locally after a confirmed delete — deletion has no ripple to any
  // sibling row, so this is the one mutation that does NOT need a full reload.
  removeLocal: (id: string) => void
}

export function useWhatsAppConnections(): UseWhatsAppConnectionsResult {
  const [connections, setConnections] = useState<WhatsappConnectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // §9: a boolean mount-ref must be re-armed in the effect SETUP (not cleanup-only),
  // or StrictMode's dev double-invoke leaves it permanently false.
  const mountedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const { rows } = unwrapList<WhatsappConnectionRow>(await api.get('/whatsapp'))
      if (mountedRef.current) setConnections(rows)
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  // Drop one row after a confirmed delete (deletion has no ripple to any sibling).
  const removeLocal = (id: string) => setConnections(prev => prev.filter(c => c.id !== id))

  return { connections, loading, error, reload: load, removeLocal }
}
