/**
 * useNotifications — graceful notifications feed for the topbar bell.
 *
 * Polls GET /notifications; the list stays empty (no badge) until the backend
 * feed exists, so the bell never breaks. Seen-state is persisted best-effort via
 * POST /notifications/seen, with an optimistic local update so the badge clears
 * immediately on open. Never logs PII (§8).
 */
import { useState, useEffect, useCallback } from 'react'
import api, { unwrapList } from '@/lib/api'

export interface AppNotification {
  id: string | number
  title?: string
  body?: string
  created_at?: string
  seen?: boolean
  link?: string
  [k: string]: unknown
}

export function useNotifications(pollMs = 60000) {
  const [items, setItems] = useState<AppNotification[]>([])

  // Load the feed; any failure (incl. a missing endpoint) resolves to empty.
  const load = useCallback(() => {
    api.get('/notifications')
      .then(r => setItems((unwrapList(r).rows) as AppNotification[]))
      .catch(() => setItems([]))
  }, [])

  // Poll on an interval; clean up on unmount.
  useEffect(() => {
    load()
    const id = setInterval(load, pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  const unseen = items.filter(n => !n.seen).length

  // Mark all seen — optimistic locally, best-effort on the backend.
  const markAllSeen = useCallback(() => {
    setItems(prev => (prev.some(n => !n.seen) ? prev.map(n => ({ ...n, seen: true })) : prev))
    api.post('/notifications/seen').catch(() => {})
  }, [])

  return { items, unseen, markAllSeen, reload: load }
}
