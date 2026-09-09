/**
 * useWorkflowRunControl — RUN-CONTROL-1's run lifecycle, extracted from
 * useWorkflowEditor (which had grown past the ~400-line split trigger, §3):
 * starting a workflow run, polling it live (useWorkflowRun), the 409 "already
 * running" single-flight conflict, and stopping it. Pure extraction — identical
 * behaviour, useWorkflowEditor stays the composer and callers are unchanged.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkflowRun } from './useWorkflowRun'
import api from '@/lib/api'
import { resolveWorkflowBaseURL } from '@/lib/workflowApi'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import type { RunRow } from '@/types/reports'
import type { ActionBudget } from '@/types/actionBudget'

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
  const { t } = useTranslation('workflows')
  const [running,        setRunning]        = useState(false)
  const [runError,       setRunError]       = useState<string | null>(null)
  // PRIJSMODEL-C 30-08: the staffel stand on a 422 { status: 'budget_exceeded',
  // budget } — the run's own message still lands in runError as before.
  const [runBudget,      setRunBudget]      = useState<ActionBudget | null>(null)
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
    Promise.resolve(api.get(`/workflows/${workflowId}/runs`, { baseURL: resolveWorkflowBaseURL() }))
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
  // S1 Lane C: `subject` optionally seeds the run context with one record
  // ({entity_type, entity_id}) — no UI wires this yet (no call site asked for
  // it), the param only exists so a future record-scoped "run this workflow for
  // THIS record" action doesn't need another round-trip through this hook.
  // entity_type is the closed union `subjectContext()` (WorkflowController.php)
  // actually accepts — a wider `string` would let a typo compile clean and 422
  // at runtime instead.
  const handleRun = useCallback(async (opts?: {
    dryRun?: boolean
    subject?: { entity_type: 'candidate' | 'application' | 'vacancy' | 'customer' | 'match'; entity_id: string }
  }) => {
    setRunning(true)
    setRunError(null)
    setRunBudget(null)
    setRunConflict(false)
    try {
      // Actually execute the SAVED workflow server-side (the engine runs the
      // steps on the queue). This button used to only animate — never ran.
      const { default: api } = await import('@/lib/api')
      // WF-DRYRUN-FE-1: {dry_run:true} on the SAME route/port/single-flight —
      // undefined body (a real run) is unchanged, so the existing contract test
      // pinning `undefined` here still holds. Build the body from whichever
      // optional keys are actually set, so a plain call still posts `undefined`.
      const body: Record<string, unknown> = {}
      if (opts?.dryRun) body.dry_run = true
      if (opts?.subject) body.subject = opts.subject
      const hasBody = Object.keys(body).length > 0
      // Start the queued run and keep its id so we can poll the REAL per-step status
      // (WF-R3) — replaces the old fixed 800ms fake walk. Shape: { run: { id } }.
      // 409 (already running) gets its own inline feedback; 422 (WORKFLOW-422)
      // is surfaced by this hook's own catch below — keep both out of the
      // api.ts dev interceptor's generic double-toast.
      const res = await api.post(`/workflows/${workflowId}/run`, hasBody ? body : undefined, { quietStatuses: [409, 422], baseURL: resolveWorkflowBaseURL() })
      const runId = (res.data?.run?.id ?? res.data?.data?.id ?? res.data?.id) as string | number | undefined
      if (runId != null) setActiveRunId(runId)

      // Show the run history / live viewer (the polled run drives node colours).
      onRunStarted?.()
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; run_id?: string | number; status?: string; budget?: ActionBudget } } }
      // RUN-CONTROL-1 single-flight: 409 = this workflow already has a live run.
      // Point the viewer at THAT run (poll + logs panel) and show "loopt al"
      // ("already running").
      if (e.response?.status === 409) {
        if (e.response.data?.run_id != null) setActiveRunId(e.response.data.run_id)
        setRunConflict(true)
        onRunStarted?.()
      } else {
        // Surface the backend reason (e.g. "Workflow is niet actief" / "Workflow
        // is not active" on a draft) via the SAME extraction as the toast, so the
        // header's visible error and the toast never disagree (WORKFLOW-422).
        // PRIJSMODEL-C 30-08: a 422 { status: 'budget_exceeded', budget } already
        // falls in here for the message — also thread the staffel stand through
        // so the header can show its upgrade hint.
        const reason = extractApiError(err, t('runControl.failed'))
        setRunError(reason)
        setRunBudget(e.response?.data?.status === 'budget_exceeded' ? (e.response.data.budget ?? null) : null)
        notifyError(reason)
      }
    } finally {
      setRunningNodeId(null)
      setRunning(false)
    }
  }, [workflowId, onRunStarted, t])

  // S1 Lane C (KOIOS-ADVIES-OVERAL-1): starts a workflow's own filtered ENTRY
  // step over its whole matching set in one server-side pass (CONTRACT-CHANGELOG
  // 2026-09-04, POST /workflows/{id}/run-bulk). Above the tenant's
  // koios_advice.bulk_confirm_threshold without `confirm: true`, the backend
  // answers 409 {count, matched_records, threshold} — this hook does NOT show a
  // dialog itself; it returns those numbers so the caller can open the shared
  // ConfirmDialog (`workflows.runBulk.confirm`) and re-call `runBulk({ confirm:
  // true })`. A 202 adopts the started run exactly like handleRun.
  //
  // REPAIR M1: WorkflowController::runBulk() throws TWO structurally different
  // 409s (measured) — the threshold body {count, matched_records, threshold}
  // above, and WorkflowAlreadyRunningException's {message, run_id} single-flight
  // conflict (same shape handleRun's 409 branch already handles 40 lines up).
  // Treating every 409 as "threshold" made an already-running workflow read as
  // "0 records (threshold 0)" and, worse, re-POST forever on confirm. Discriminate
  // on the payload shape: `run_id` present → already running (adopt it exactly
  // like handleRun does); `threshold` present → the real confirm path.
  const runBulk = useCallback(async (opts?: { confirm?: boolean }): Promise<
    | { status: 'started'; runId: string | null; count: number }
    | { status: 'confirm'; count: number; matchedRecords: number; threshold: number }
    | { status: 'already_running'; runId: string | null }
    | { status: 'error'; message: string }
  > => {
    setRunning(true)
    setRunError(null)
    try {
      const { default: api } = await import('@/lib/api')
      // `filters` is deliberately never sent — the entry step's own saved
      // filters always decide the set (CONTRACT-CHANGELOG: sending one 422s).
      const body = opts?.confirm ? { confirm: true } : undefined
      // WORKFLOW-422: 422 is surfaced by this hook's own catch below — keep it
      // out of the api.ts dev interceptor's generic double-toast, same as 409.
      const res = await api.post(`/workflows/${workflowId}/run-bulk`, body, { quietStatuses: [409, 422], baseURL: resolveWorkflowBaseURL() })
      const rawRunId = (res.data?.run_id ?? res.data?.run?.id) as string | number | undefined
      const runId = rawRunId != null ? String(rawRunId) : null
      const count = (res.data?.count ?? 0) as number
      if (runId != null) setActiveRunId(runId)
      onRunStarted?.()
      return { status: 'started', runId, count }
    } catch (err) {
      const e = err as { response?: { status?: number; data?: {
        count?: number; matched_records?: number; threshold?: number; message?: string; run_id?: string | number
      } } }
      if (e.response?.status === 409) {
        const d = e.response.data ?? {}
        // Single-flight conflict FIRST — WorkflowAlreadyRunningException's body
        // carries `run_id`, never `threshold`. Mirrors handleRun's 409 branch.
        if (d.run_id != null) {
          const runId = String(d.run_id)
          setActiveRunId(runId)
          setRunConflict(true)
          onRunStarted?.()
          return { status: 'already_running', runId }
        }
        return { status: 'confirm', count: d.count ?? 0, matchedRecords: d.matched_records ?? 0, threshold: d.threshold ?? 0 }
      }
      // WORKFLOW-422: same extraction as handleRun, so a validation-bag 422
      // (only `errors`, no top-level `message`) still surfaces a real reason
      // instead of the old empty-string fallback.
      const reason = extractApiError(err, t('runControl.failed'))
      setRunError(reason)
      notifyError(reason)
      return { status: 'error', message: reason }
    } finally {
      setRunning(false)
    }
  }, [workflowId, onRunStarted, t])

  // RUN-CONTROL-1: the polled run can still be cancelled → show the stop button.
  const liveRunActive = liveRun != null && ['running', 'waiting'].includes(String(liveRun.status))

  // After a successful stop the conflict is over; the poll picks up `cancelled`.
  const handleStopped = useCallback(() => {
    setRunConflict(false)
    setRunError(null)
    setRunBudget(null)
  }, [])

  return {
    running, runError, setRunError, runBudget, runningNodeId,
    activeRunId, liveRun, liveRunActive, runConflict, handleStopped, handleRun, runBulk,
  }
}
