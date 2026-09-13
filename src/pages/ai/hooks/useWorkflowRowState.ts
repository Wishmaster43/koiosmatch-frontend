/**
 * useWorkflowRowState — the running/restoring/hover local UI-state trio shared
 * by WorkflowCard and WorkflowListRow: both render one workflow tile/row and
 * need the same three async-action indicators (run in flight, restore in
 * flight, mouse hover for the row background). Hook order stays identical at
 * both call sites — three useState calls, called unconditionally, first thing
 * in the component. (DRY round 11, LAYOUT.)
 */
import { useState } from 'react'
import type { Workflow } from '@/types/workflow'

// Shared archive/restore/trash lifecycle props for one workflow card/row
// (WorkflowCard/WorkflowListRow), on top of each caller's own extras
// (WorkflowListRow adds folderName/onToggleStatus).
export interface WorkflowRowLifecycleProps {
  workflow: Workflow
  onRun: (id?: string | number) => void | Promise<void>
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
  // Tenant grace window — feeds the trashed card/row's erase note (DD-MM-YYYY).
  graceDays?: number | null
}

export function useWorkflowRowState() {
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [hover, setHover] = useState(false)
  return { running, setRunning, restoring, setRestoring, hover, setHover }
}
