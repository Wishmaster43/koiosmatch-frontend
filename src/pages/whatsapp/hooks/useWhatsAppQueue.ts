/**
 * useWhatsAppQueue — data layer for the "Wachtrij" tab (WABA batch queue, R3a).
 * Loads today's batches from GET /whatsapp-queue and polls every 5s ONLY while at
 * least one batch is still active — the moment every batch has finished, polling
 * stops so the tab doesn't keep hammering the backend while idle. The endpoint now
 * ships (item 11, was quiet404'd before it existed) — a 404 still flags the calm
 * "not available yet" state below, but also surfaces in the dev log like any
 * other real failure.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { WaQueueBatch } from '@/types/whatsapp'

const POLL_MS = 5000

// A batch still running: no finished_at and a non-terminal status.
export const isBatchActive = (b: WaQueueBatch): boolean =>
  !b.finished_at && String(b.status ?? '').toLowerCase() !== 'finished'

export function useWhatsAppQueue() {
  const [batches,      setBatches]      = useState<WaQueueBatch[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load today's batches; a 404 flags "not shipped yet", any other failure is a real error.
  const load = useCallback(() => {
    api.get('/whatsapp-queue')
      .then(r => { setBatches((unwrapList(r).rows) as WaQueueBatch[]); setNotAvailable(false); setError(false) })
      .catch(err => {
        if (err.response?.status === 404) setNotAvailable(true)
        else setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Poll every 5s only while an active batch exists; stop the instant none remain.
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (notAvailable || error || !batches.some(isBatchActive)) return
    timerRef.current = setInterval(load, POLL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [batches, notAvailable, error, load])

  return { batches, loading, error, notAvailable, reload: load }
}
