/**
 * useWorkflowRunControl — RUN-CONTROL-1's run lifecycle, extracted from
 * useWorkflowEditor (which had grown past the ~400-line split trigger, §3):
 * starting a workflow run, polling it live (useWorkflowRun), the 409 "already
 * running" single-flight conflict, and stopping it. Pure extraction — identical
 * behaviour, useWorkflowEditor stays the composer and callers are unchanged.
 */
import { useState, useCallback } from 'react'
import { useWorkflowRun } from './useWorkflowRun'

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
  // i18n "loopt al" feedback while the logs panel points at that run.
  const [runConflict,    setRunConflict]    = useState(initialRunId != null)

  const handleRun = useCallback(async () => {
    setRunning(true)
    setRunError(null)
    setRunConflict(false)
    try {
      // Actually execute the SAVED workflow server-side (the engine runs the
      // steps on the queue). This button used to only animate — never ran.
      const { default: api } = await import('@/lib/api')
      // Start the queued run and keep its id so we can poll the REAL per-step status
      // (WF-R3) — replaces the old fixed 800ms fake walk. Shape: { run: { id } }.
      // 409 (already running) gets its own inline feedback — keep the generic dev toast out.
      const res = await api.post(`/workflows/${workflowId}/run`, undefined, { quietStatuses: [409] })
      const runId = (res.data?.run?.id ?? res.data?.data?.id ?? res.data?.id) as string | number | undefined
      if (runId != null) setActiveRunId(runId)

      // Show the run history / live viewer (the polled run drives node colours).
      onRunStarted?.()
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; run_id?: string | number } } }
      // RUN-CONTROL-1 single-flight: 409 = this workflow already has a live run.
      // Point the viewer at THAT run (poll + logs panel) and show "loopt al".
      if (e.response?.status === 409) {
        if (e.response.data?.run_id != null) setActiveRunId(e.response.data.run_id)
        setRunConflict(true)
        onRunStarted?.()
      } else {
        // Surface the backend reason (e.g. "Workflow is niet actief" on a draft);
        // empty string = generic message via i18n in the component.
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
