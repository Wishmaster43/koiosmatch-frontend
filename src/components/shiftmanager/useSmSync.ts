/**
 * useSmSync — fires POST /sm_reports/sync (SYNC-1) for one chosen connection and
 * tracks the queued/throttled/error feedback. The response is 202 {queued[],
 * last_synced_at} — work is QUEUED, not done. GEO-POLL-1: a queued job "can take a
 * few minutes", so this re-checks the dashboard sync-sources query on a backoff
 * schedule until its cached snapshot actually changes (the job landed) or an
 * honest cap runs out — never a single fixed-delay refetch sized to yesterday's
 * latency, and never an unbounded interval poll either.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// Backoff schedule for re-checking sync-sources after a queued sync — ~2.5 minutes total.
const SYNC_POLL_DELAYS_MS = [5000, 5000, 10000, 15000, 20000, 30000, 30000, 30000]

export type SmSyncScope = 'all' | 'candidates' | 'customers' | 'shifts'
export type SmSyncResult =
  | { kind: 'queued' }
  | { kind: 'throttled'; retryAfter: number }
  | { kind: 'error'; detail?: string }

// Fires the queued sync + tracks queued/throttled/error feedback, then backoff-polls
// sync-sources until it changes or the cap runs out (see module doc above).
export function useSmSync() {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult]   = useState<SmSyncResult | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped on every new sync/unmount so an in-flight poll from a stale sync never
  // keeps ticking after a fresher one started.
  const generationRef = useRef(0)

  // Stops any in-flight backoff poll.
  const stopPoll = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    generationRef.current += 1
  }, [])

  useEffect(() => stopPoll, [stopPoll])

  // Backoff poll: re-check sync-sources until its cached snapshot changes (the
  // queued job landed) or the honest delay schedule runs out. Held in a ref (not
  // useCallback) so the self-recursive call carries no TDZ warning and `sync`
  // below never needs it in its own dependency array. REFS-IN-EFFECTS-1: written
  // in a dependency-less effect, never during render.
  const pollUntilLandedRef = useRef<(generation: number, before: string, step: number) => void>(() => {})
  useEffect(() => {
    pollUntilLandedRef.current = (generation, before, step) => {
      if (step >= SYNC_POLL_DELAYS_MS.length) return
      timerRef.current = setTimeout(async () => {
        if (generationRef.current !== generation) return
        await queryClient.invalidateQueries({ queryKey: ['dashboard', 'sync-sources'] })
        if (generationRef.current !== generation) return
        const after = JSON.stringify(queryClient.getQueryData(['dashboard', 'sync-sources']) ?? null)
        if (after !== before) return // landed — the dashboard/last-sync readers pick up the fresh data on their own
        pollUntilLandedRef.current(generation, before, step + 1)
      }, SYNC_POLL_DELAYS_MS[step])
    }
  })

  // Trigger the queued sync for one connection; scope defaults to the backend's own
  // 'all' default when omitted.
  const sync = useCallback(async (connectionId: string, scope?: SmSyncScope) => {
    stopPoll()
    setSyncing(true)
    setResult(null)
    try {
      const before = JSON.stringify(queryClient.getQueryData(['dashboard', 'sync-sources']) ?? null)
      await api.post('/sm_reports/sync', { connection_id: connectionId, scope })
      setResult({ kind: 'queued' })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'sync-sources'] })
      pollUntilLandedRef.current(generationRef.current, before, 0)
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; retry_after?: number; errors?: Record<string, string[]> } } }
      const status = e.response?.status
      if (status === 429) {
        setResult({ kind: 'throttled', retryAfter: e.response?.data?.retry_after ?? 60 })
      } else {
        // 422 (unknown/inactive connection) surfaces the field error; other statuses
        // fall back to the server message, then the generic i18n failed-copy.
        const detail = e.response?.data?.errors?.connection_id?.[0] ?? e.response?.data?.message
        setResult({ kind: 'error', detail })
      }
    } finally {
      setSyncing(false)
    }
  }, [queryClient, stopPoll])

  return { syncing, result, sync }
}
