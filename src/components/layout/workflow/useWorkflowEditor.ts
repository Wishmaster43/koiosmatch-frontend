/**
 * useWorkflowEditor — thin composer for WorkflowCanvasEditor: wires the graph
 * (useWorkflowGraph), the trigger/save/dirty-check state (useWorkflowTrigger),
 * the side-panel visibility (useWorkflowPanels) and run control
 * (useWorkflowRunControl) into the one flat props object the JSX renders.
 * ARCH-01 split (§3, at ~400 lines): each concern now lives in its own hook —
 * this file only composes them and merges live-run status onto the nodes.
 */
import { useMemo, useCallback } from 'react'
import { useWorkflowRunControl } from './useWorkflowRunControl'
import { TERMINAL } from './useWorkflowRun'
import { useOutputSeeding } from './useOutputSeeding'
import { useWorkflowGraph } from './useWorkflowGraph'
import { useWorkflowPanels } from './useWorkflowPanels'
import { useWorkflowTrigger } from './useWorkflowTrigger'
import type { Workflow } from '@/types/workflow'

// Pure helpers extracted to workflowEditorUtils (§3, split at ~400 lines); re-exported
// here so existing test imports (`from './useWorkflowEditor'`) keep working unchanged.
export { flattenSample, buildVarFields, computeWorkflowSnapshot } from './workflowEditorUtils'

// Owns the full editor session for one workflow: graph state, trigger config, run
// control and dirty-checking, returned as one flat props object for the JSX to render.
export function useWorkflowEditor({ workflow, onSave, initialRunId = null }: {
  workflow: Workflow
  onSave: (updated: Workflow, closeAfter?: boolean) => void
  // RUN-CONTROL-1: open the editor already focused on an active run (the 409
  // "already running" path from the list page) — the logs panel opens on it.
  initialRunId?: string | number | null
}) {
  const panels = useWorkflowPanels({ initialRunId })
  const { setOutputState } = panels

  // A node test-run's output goes to the panels hook's output viewer — routed via
  // this callback so useWorkflowGraph never needs to know about panels. Memoized on
  // `setOutputState` (a stable useState setter, destructured so eslint's
  // exhaustive-deps can see it is a plain identifier rather than a member
  // expression): `handleNodeRun` in useWorkflowGraph depends on this callback and
  // is published as a React context value (NodeRunContext) consumed by every
  // canvas node, so an inline arrow here would re-create it — and every node — on
  // every editor render, e.g. each workflow-name keystroke.
  const handleNodeRunOutput = useCallback(
    (nodeId: string, output: unknown) => setOutputState({ nodeId, output }),
    [setOutputState],
  )
  const graph = useWorkflowGraph({ workflow, onNodeRunOutput: handleNodeRunOutput })

  const trigger = useWorkflowTrigger({
    workflow, nodes: graph.nodes, edges: graph.edges,
    initialNodes: graph.initialNodes, initialEdges: graph.initialEdges, onSave,
  })

  // Run lifecycle (start/stop/poll/409-conflict) — extracted to its own hook
  // (§3, split at ~400 lines) since this composer stays focused on wiring.
  const {
    running, runError, setRunError, runBudget, runningNodeId,
    activeRunId, liveRun, liveRunActive, runConflict, handleStopped, handleRun,
  } = useWorkflowRunControl({ workflowId: workflow.id, initialRunId, onRunStarted: panels.openLogsOnRun })

  // Run-viewer output-seeding (extracted hook): once the polled run is terminal,
  // copies each step's output onto its matching node so the VariablePicker and the
  // ConfigPanel "Uitvoering" tab (OutputTree) get real data instead of only whatever
  // a manual per-node test-run produced.
  useOutputSeeding(liveRun, graph.setNodes)

  // WF-R3: map the polled run's steps (step_id → status) onto the nodes so the
  // canvas shows real per-step progress (running/success/failed) live.
  // NODE-PROGRESS-1 (Danny 23-07): also carry the live {done,total} loop progress
  // + the finished item count, so the node ring renders a Make-style progress arc
  // with a counter badge ("38") instead of only a glow.
  const stepLive = useMemo(() => {
    const status: Record<string, string> = {}
    const progress: Record<string, { done: number; total: number }> = {}
    const itemsTotal: Record<string, number> = {}
    // Whether the polled run is still live: once it reaches a terminal state the
    // poll stops, so a sub-100% arc could never fill further — the canvas then
    // shows only the badge, never a frozen partial ring.
    const runActive = liveRun != null && !TERMINAL.has(String(liveRun.status))
    ;(liveRun?.steps ?? []).forEach(s => {
      const id = s.step_id != null ? String(s.step_id) : undefined
      if (!id) return
      if (s.status) status[id] = String(s.status)
      if (s.progress && s.progress.total > 0) progress[id] = s.progress
      if (typeof s.items_total === 'number') itemsTotal[id] = s.items_total
    })
    return { status, progress, itemsTotal, runActive }
  }, [liveRun])

  const nodesWithFirst = graph.nodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      isFirst: n.id === graph.firstNodeId,
      isRunning: n.id === runningNodeId || stepLive.status[n.id] === 'running',
      status: stepLive.status[n.id],
      progress: stepLive.progress[n.id] ?? null,
      itemsTotal: stepLive.itemsTotal[n.id] ?? null,
      runActive: stepLive.runActive,
    },
  }))

  return {
    edges: graph.edges, onNodesChange: graph.onNodesChange, onEdgesChange: graph.onEdgesChange,
    onConnect: graph.onConnect, nodesWithFirst, selectedNode: graph.selectedNode, setSelectedNodeId: graph.setSelectedNodeId,
    name: trigger.name, setName: trigger.setName, trigger: trigger.trigger, setTrigger: trigger.setTrigger,
    scheduleConfig: trigger.scheduleConfig, setScheduleConfig: trigger.setScheduleConfig,
    status: trigger.status, setStatus: trigger.setStatus,
    saved: trigger.saved, running, runError, runBudget, setRunError,
    showSchedule: panels.showSchedule, setShowSchedule: panels.setShowSchedule,
    widePanelActive: panels.widePanelActive, setWidePanelActive: panels.setWidePanelActive,
    showLogs: panels.showLogs, setShowLogs: panels.setShowLogs,
    liveRun, activeRunId, liveRunActive, runConflict, handleStopped,
    pickerState: panels.pickerState, setPickerState: panels.setPickerState,
    filterState: panels.filterState, setFilterState: panels.setFilterState,
    outputState: panels.outputState, setOutputState: panels.setOutputState,
    firstNodeId: graph.firstNodeId, setStartNodeId: graph.setStartNodeId, startInvalid: graph.startInvalid,
    getUpstreamVariables: graph.getUpstreamVariables,
    handleEdgeAdd: panels.handleEdgeAdd, handleEdgeDelete: graph.handleEdgeDelete,
    handleEdgeFilter: panels.handleEdgeFilter, saveEdgeFilter: graph.saveEdgeFilter, handleNodeRun: graph.handleNodeRun,
    insertModule: graph.insertModule, addRouterBranch: graph.addRouterBranch, updateNodeConfig: graph.updateNodeConfig,
    deleteNode: graph.deleteNode, handleSave: trigger.handleSave, handleRun, isDirty: trigger.isDirty,
  }
}
