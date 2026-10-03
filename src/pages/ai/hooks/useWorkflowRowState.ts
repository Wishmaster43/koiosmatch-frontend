/**
 * useWorkflowRowState — the running/restoring/hover local UI-state trio shared
 * by WorkflowCard and WorkflowListRow: both render one workflow tile/row and
 * need the same three async-action indicators (run in flight, restore in
 * flight, mouse hover for the row background). Hook order stays identical at
 * both call sites — three useState calls, called unconditionally, first thing
 * in the component. (DRY round 11, LAYOUT.)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Workflow } from '@/types/workflow'

// Shared archive/restore/trash lifecycle props for one workflow card/row
// (WorkflowCard/WorkflowListRow), on top of each caller's own extras
// (WorkflowListRow adds folderName/onToggleStatus).
export interface WorkflowRowLifecycleProps {
  workflow: Workflow
  // N007-POINT3-FIX-1 verifier fix: onRun may resolve `false` for a failed/refused
  // run (handleRun's own catch branches) — runWithDoneFlash only flashes "just
  // ran" when the result isn't explicitly `false`.
  onRun: (id?: string | number) => void | boolean | Promise<void | boolean>
  // WORKFLOW-PERMS-1: false renders Run disabled with the reason (workflows.run missing).
  canRun?: boolean
  onEdit: () => void
  // Archive/restore lifecycle (TRASH-OVERAL-1b) — both settings.update-gated.
  canManageFolders?: boolean
  onArchive?: () => void
  onRestore?: () => void | Promise<void>
  // TRASH-OVERAL-2: mark for erasure (workflows.delete) on an archived card/row;
  // unmark (settings.update) on a trashed card/row. Absent prop = hidden (§7).
  onMarkDeletion?: () => void
  onUnmark?: () => void | Promise<void>
  // ONIX N-007: disables the unmark button while its own POST is in flight.
  unmarkBusy?: boolean
  // Tenant grace window — feeds the trashed card/row's erase note (DD-MM-YYYY).
  graceDays?: number | null
}

export function useWorkflowRowState() {
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [hover, setHover] = useState(false)
  // N007-POINT3-FIX-1: true for a short "just ran" flash right after a run's
  // refetch has landed, before the button returns to its normal "Run" label.
  const [justRan, setJustRan] = useState(false)
  // Alive guard for the flash timeout below — never setState after unmount.
  const aliveRef = useRef(true)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false } }, [])

  // N007-POINT3-FIX-1: the shared "run once, flash done" wrapper for
  // WorkflowCard/WorkflowListRow's Run button — both had this identical block
  // (CLONE-BY-CONSTRUCTION-1), so it lives here once. A click while already
  // running or still flashing "just ran" is a no-op; onRun's own promise
  // (resolving only once its refetch has landed, see useWorkflowsData.handleRun)
  // decides how long `running` stays true.
  const runWithDoneFlash = useCallback(async (
    onRun: (id?: string | number) => void | boolean | Promise<void | boolean>,
    id?: string | number,
  ) => {
    if (running || justRan) return
    setRunning(true)
    try {
      // N007-POINT3-FIX-1 verifier fix: an explicit `false` means the run FAILED
      // or was refused (409) — never flash "just ran" over something that didn't run.
      const result = await onRun(id)
      if (result !== false) {
        setJustRan(true)
        setTimeout(() => { if (aliveRef.current) setJustRan(false) }, 3000)
      }
    } finally {
      setRunning(false)
    }
  }, [running, justRan])

  return { running, setRunning, restoring, setRestoring, hover, setHover, justRan, setJustRan, runWithDoneFlash }
}
