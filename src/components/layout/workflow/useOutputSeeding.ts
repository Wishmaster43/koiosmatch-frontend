/**
 * useOutputSeeding — run-viewer output-seeding: once a polled workflow run (see
 * useWorkflowRun) reaches a terminal status, copies each step's output onto its
 * matching editor node, matched by the STABLE step/node id (backend contract — ids
 * never change across saves). This is what lets the VariablePicker's flattenSample
 * see REAL fields instead of only whatever a manual per-node test-run produced, and
 * gives the ConfigPanel "Uitvoering" tab (OutputTree) real data to render. A failed
 * step surfaces via notifyError exactly once — the ref guard stops it firing again
 * on every subsequent poll-driven render of the same terminal run.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError } from '@/lib/notify'
import { TERMINAL } from './useWorkflowRun'
import type { FlowNode } from '@/types/workflow'
import type { RunRow, RunStep } from '@/types/reports'

// A run's steps live under `steps` (live/WF-R3 rows) or the legacy `step_results`.
function stepsOf(run: RunRow): RunStep[] {
  return run.steps?.length ? run.steps : (run.step_results ?? [])
}

// Seed each node's stored `output` from a finished run's steps, matched by the
// stable step/node id. Exported for unit testing, mirrors flattenSample's pattern.
export function seedOutputsFromSteps(nds: FlowNode[], steps: RunStep[]): FlowNode[] {
  if (!steps.length) return nds
  return nds.map(n => {
    const step = steps.find(s => String(s.step_id ?? '') === n.id)
    if (!step || step.output === undefined) return n
    return { ...n, data: { ...n.data, output: step.output } }
  })
}

export function useOutputSeeding(liveRun: RunRow | null, setNodes: (updater: (nds: FlowNode[]) => FlowNode[]) => void) {
  const { t } = useTranslation('workflows')
  // Guards this effect so a terminal run is only processed once (react-query stops
  // polling at that point, but this stays defensive against re-renders).
  const seededRunIdRef = useRef<string | number | null>(null)

  useEffect(() => {
    if (!liveRun || liveRun.id == null || !liveRun.status || !TERMINAL.has(liveRun.status)) return
    if (seededRunIdRef.current === liveRun.id) return
    seededRunIdRef.current = liveRun.id

    const steps = stepsOf(liveRun)
    if (steps.length) setNodes(nds => seedOutputsFromSteps(nds, steps))

    const failedStep = steps.find(s => s.status === 'failed' || s.status === 'error' || s.ok === false)
    if (failedStep) {
      notifyError(failedStep.error_message || failedStep.error || failedStep.message || t('common:actionFailed'))
    }
  }, [liveRun, setNodes, t])
}
