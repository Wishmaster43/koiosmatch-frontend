/**
 * useWorkflowQueue — WF-WACHTRIJ-FE-1's data hook. Fetches the tenant-wide (or
 * one-workflow) queue snapshot (K-171, GET /workflows/queue) — four lists
 * (pending / waiting / scheduled / retrying) plus their counts. Four UI states;
 * a 403 (missing settings.view) degrades to an honest calm empty state rather
 * than a crash — the caller never needs to special-case the permission.
 */
import { useEffect, useState, useCallback } from 'react'
import api, { unwrap } from '@/lib/api'

// One entry per list — shapes mirror the K-171 contract exactly (never invented).
export interface QueuePendingEntry { run_id?: string | number; workflow_id?: string | number; workflow_name?: string; queued_at?: string; trigger?: string }
// Waiting rows carry resume_at INSTEAD of queued_at (QueueOverview::waiting()
// returns run_id/workflow_id/workflow_name/resume_at/trigger only — measured,
// never inherited from pending).
export interface QueueWaitingEntry { run_id?: string | number; workflow_id?: string | number; workflow_name?: string; resume_at?: string; trigger?: string }
export interface QueueScheduledEntry { workflow_id?: string | number; workflow_name?: string; next_run_at?: string; schedule_label?: string }
export interface QueueRetryingEntry { run_id?: string | number; workflow_id?: string | number; workflow_name?: string; attempts?: number; next_attempt_at?: string; last_error?: string }
export interface QueueCounts { pending?: number; waiting?: number; scheduled_today?: number; retrying?: number }
export interface QueueSnapshot {
  pending: QueuePendingEntry[]
  waiting: QueueWaitingEntry[]
  scheduled: QueueScheduledEntry[]
  retrying: QueueRetryingEntry[]
  counts: QueueCounts
}

const EMPTY: QueueSnapshot = { pending: [], waiting: [], scheduled: [], retrying: [], counts: {} }

// workflow_id is validated server-side as a uuid — the callers only ever hold
// workflow uuids, so the param is a string.
export function useWorkflowQueue(workflowId?: string) {
  const [data,    setData]    = useState<QueueSnapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  // K-171: a 403 (module:workflows + settings.view gate) is a calm degrade, not
  // a red error banner — the caller renders the honest "no access" empty state.
  const [forbidden, setForbidden] = useState(false)
  const [tick, setTick] = useState(0)
  const retry = useCallback(() => setTick(v => v + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true); setError(false); setForbidden(false)
    const url = workflowId != null ? `/workflows/queue?workflow_id=${encodeURIComponent(String(workflowId))}` : '/workflows/queue'
    api.get(url)
      .then(res => { if (alive) setData(unwrap<QueueSnapshot>(res) ?? EMPTY) })
      .catch(err => {
        if (!alive) return
        if (err?.response?.status === 403) setForbidden(true)
        else setError(true)
        setData(EMPTY)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [workflowId, tick])

  return { ...data, loading, error, forbidden, retry }
}
