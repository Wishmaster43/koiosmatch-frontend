/**
 * useWorkflowPanels — visibility/target state for the editor's side panels: the
 * module picker, the edge-filter panel, the node-output viewer, the schedule
 * modal, the logs/run panel and the wide-panel toggle. Extracted from
 * useWorkflowEditor (§3, split at ~400 lines) — pure UI state, no graph
 * mutation and no trigger/schedule persistence.
 */
import { useState, useCallback } from 'react'

export function useWorkflowPanels({ initialRunId = null }: { initialRunId?: string | number | null } = {}) {
  // F2: `routerId` selects "new branch" mode — the picker's pick goes to
  // addRouterBranch instead of insertModule (see WorkflowCanvasEditor's onSelect).
  const [pickerState,     setPickerState]     = useState<{ edgeId?: string; append?: boolean; routerId?: string } | null>(null)
  const [showSchedule,    setShowSchedule]    = useState(false)
  const [widePanelActive, setWidePanelActive] = useState(false)
  const [showLogs,        setShowLogs]        = useState(initialRunId != null)
  const [filterState,     setFilterState]     = useState<{ edgeId: string } | null>(null)
  const [outputState,     setOutputState]     = useState<{ nodeId: string; output: unknown } | null>(null)

  // Reveal the logs/run-viewer panel whenever a run starts (or hits a 409
  // conflict) — kept stable so the run-control hook's handleRun identity doesn't churn.
  const openLogsOnRun = useCallback(() => setShowLogs(true), [])

  // Stable callback passed via context — never touches edge objects
  const handleEdgeAdd = useCallback((edgeId: string) => {
    setPickerState({ edgeId })
  }, [])

  // User clicked an edge's filter control — open the filter panel for that edge.
  const handleEdgeFilter = useCallback((edgeId: string) => {
    setFilterState({ edgeId })
  }, [])

  return {
    pickerState, setPickerState, showSchedule, setShowSchedule, widePanelActive, setWidePanelActive,
    showLogs, setShowLogs, filterState, setFilterState, outputState, setOutputState,
    openLogsOnRun, handleEdgeAdd, handleEdgeFilter,
  }
}
