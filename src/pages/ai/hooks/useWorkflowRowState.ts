/**
 * useWorkflowRowState — the running/restoring/hover local UI-state trio shared
 * by WorkflowCard and WorkflowListRow: both render one workflow tile/row and
 * need the same three async-action indicators (run in flight, restore in
 * flight, mouse hover for the row background). Hook order stays identical at
 * both call sites — three useState calls, called unconditionally, first thing
 * in the component. (DRY round 11, LAYOUT.)
 */
import { useState } from 'react'

export function useWorkflowRowState() {
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [hover, setHover] = useState(false)
  return { running, setRunning, restoring, setRestoring, hover, setHover }
}
