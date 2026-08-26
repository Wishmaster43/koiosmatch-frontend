/**
 * useWorkflowRunControl — RUN-CONTROL-1's run lifecycle, extracted from
 * useWorkflowEditor (which had grown past the ~400-line split trigger, §3):
 * starting a workflow run, polling it live (useWorkflowRun), the 409 "already
 * running" single-flight conflict, and stopping it. Pure extraction — identical
 * behaviour, useWorkflowEditor stays the composer and callers are unchanged.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useWorkflowRun } from './useWorkflowRun'
import api from '@/lib/api'
import type { RunRow } from '@/types/reports'

// Owns a workflow's run lifecycle: starting, live-polling, the 409 conflict, and stopping; extracted so useWorkflowEditor stays under its size cap.
export function useWorkflowRunControl({ workflowId, initialRunId = null, onRunStarted }: {
  workflowId: string | number | undefined
  // RUN-CONTROL-1: open already focused on an active run (the 409 "already
  // running" path from the list page) — the logs panel opens on it.
  initialRunId?: string | number | null
  // Fired on a successful start AND on a 409 conflict, so the caller can reveal
  // its own run viewer (that panel-visibility state lives in the composer — it
  // is also toggled independently of any run, so it stays out of this hook).
  onRunStarted?: () => void
}) {
  const [running,        setRunning]        = useState(false)
  const [runError,       setRunError]       = useState<string | null>(null)
  const [runningNodeId,  setRunningNodeId]  = useState<string | null>(null)
  // WF-R3: the id of the run we're polling live (set by handleRun), and its steps.
  const [activeRunId,    setActiveRunId]    = useState<string | number | null>(initialRunId)
  const liveRun = useWorkflowRun(activeRunId)
  // RUN-CONTROL-1: true after a 409 "already running" — the header shows the
  // i18n "loopt al" ("already running") feedback while the logs panel points
  // at that run.
  const [runConflict,    setRunConflict]    = useState(initialRunId != null)

  // RUN-VISIBILITY-1 (Danny 24-07 "opnieuw open en je ziet niet dat hij nog bezig
  // is" — "reopen it and you can't see that it's still busy"): on mount, ADOPT a
  // run that is still live for this workflow — the poll, node rings, "Bezig"
  // ("busy") status and the stop button resume as if never closed.
  const adopted = useRef(false)
  // On mount, adopt any run already live for this workflow so reopening the editor shows it as busy instead of idle.
  useEffect(() => {
    if (adopted.current || initialRunId != null || workflowId == null) return
    adopted.current = true
    let alive = true
    Promise.resolve(api.get(`/workflows/${workflowId}/runs`))
      .then(res => {
        if (!alive) return
        const body = res?.data as { data?: RunRow[] } | RunRow[] | undefined
        const rows = (Array.isArray(body) ? body : body?.data ?? []) as RunRow[]
        const live = rows.find(r => ['pending', 'running', 'waiting'].includes(String(r.status)))
        if (live?.id != null) {
          setActiveRunId(live.id)
          onRunStarted?.() // reveal the run viewer so the busy state is visible
        }
      })
      .catch(() => { /* quiet — adoption is a convenience, never an error */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  // Starts a real server-side run (or dry-run), tracks its id for polling, and turns a 409 into the 'already running' conflict state instead of a generic error.
  const handleRun = useCallback(async (opts?: { dryRun?: boolean }) => {
    setRunning(true)
    setRunError(null)
    setRunConflict(false)
    try {
      // Actually execute the SAVED workflow server-side (the engine runs the
      // steps on the queue). This button used to only animate — never ran.
      const { default: api } = await import('@/lib/api')
      // WF-DRYRUN-FE-1: {dry_run:true} on the SAME route/port/single-flight —
      // undefined body (a real run) is unchanged, so the existing contract test
      // pinning `undefined` here still holds.
      const body = opts?.dryRun ? { dry_run: true } : undefined
      // Start the queued run and keep its id so we can poll the REAL per-step status
      // (WF-R3) — replaces the old fixed 800ms fake walk. Shape: { run: { id } }.
      // 409 (already running) gets its own inline feedback — keep the generic dev toast out.
      const res = await api.post(`/workflows/${workflowId}/run`, body, { quietStatuses: [409] })
      const runId = (res.data?.run?.id ?? res.data?.data?.id ?? res.data?.id) as string | number | undefined
      if (runId != null) setActiveRunId(runId)

      // Show the run history / live viewer (the polled run drives node colours).
      onRunStarted?.()
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; run_id?: string | number } } }
      // RUN-CONTROL-1 single-flight: 409 = this workflow already has a live run.
      // Point the viewer at THAT run (poll + logs panel) and show "loopt al"
      // ("already running").
      if (e.response?.status === 409) {
        if (e.response.data?.run_id != null) setActiveRunId(e.response.data.run_id)
        setRunConflict(true)
        onRunStarted?.()
      } else {
        // Surface the backend reason (e.g. "Workflow is niet actief" / "Workflow
        // is not active" on a draft); empty string = generic message via i18n
        // in the component.
        setRunError(e.response?.data?.message ?? '')
      }
    } finally {
      setRunningNodeId(null)
      setRunning(false)
    }
  }, [workflowId, onRunStarted])

  // RUN-CONTROL-1: the polled run can still be cancelled → show the stop button.
  const liveRunActive = liveRun != null && ['running', 'waiting'].includes(String(liveRun.status))

  // After a successful stop the conflict is over; the poll picks up `cancelled`.
  const handleStopped = useCallback(() => {
    setRunConflict(false)
    setRunError(null)
  }, [])

  return {
    running, runError, setRunError, runningNodeId,
    activeRunId, liveRun, liveRunActive, runConflict, handleStopped, handleRun,
  }
}
