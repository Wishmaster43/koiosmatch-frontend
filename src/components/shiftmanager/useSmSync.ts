/**
 * useSmSync — fires POST /sm_reports/sync (SYNC-1) for one chosen connection and
 * tracks the queued/throttled/error feedback. The response is 202 {queued[],
 * last_synced_at} — work is QUEUED, not done — so this invalidates the dashboard
 * sync-sources query once immediately and once more after a short delay (a single
 * deferred refetch, never an interval poll) so "Laatste sync" catches the finished
 * job without hammering the API.
 */
import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// One re-check of the sync-sources query after this delay — not a poll loop.
const REFRESH_DELAY_MS = 10_000

export type SmSyncScope = 'all' | 'candidates' | 'customers' | 'shifts'
export type SmSyncResult =
  | { kind: 'queued' }
  | { kind: 'throttled'; retryAfter: number }
  | { kind: 'error'; detail?: string }

export function useSmSync() {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult]   = useState<SmSyncResult | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trigger the queued sync for one connection; scope defaults to the backend's own
  // 'all' default when omitted.
  const sync = useCallback(async (connectionId: string, scope?: SmSyncScope) => {
    setSyncing(true)
    setResult(null)
    try {
      await api.post('/sm_reports/sync', { connection_id: connectionId, scope })
      setResult({ kind: 'queued' })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'sync-sources'] })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'sync-sources'] })
      }, REFRESH_DELAY_MS)
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
  }, [queryClient])

  return { syncing, result, sync }
}
