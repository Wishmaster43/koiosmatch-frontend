/**
 * systemWorkflowSave (SYSWF-HIDE-FE-1): the save rules of a SYSTEM workflow (is_system, BE MANUAL-START-WORKFLOW-1).
 * The BE accepts only a rename and a folder move on it (a PUT carrying steps, active or a non-active status answers
 * 409 system_workflow_locked). Two rules follow: (1) the list hook PUTs { name, folder_id } and touches only those two
 * fields of the row, never the graph cache; (2) the editor treats every OTHER change (steps, trigger, schedule, status,
 * interview flag) as dropped: the save still carries the rename, but reports no success, keeps the dirty baseline and
 * says so, instead of flashing "saved" over a change the server never received.
 */
import type { Workflow } from '@/types/workflow'

export interface SystemWorkflowBody { name: string | undefined; folder_id: string | number | null }

// The only body a system workflow accepts: its name and folder.
export function systemWorkflowBody(updated: Workflow): SystemWorkflowBody {
  return { name: updated.name, folder_id: updated.folder_id ?? null }
}

// Strips the name (the one editor field the BE accepts) from a computeWorkflowSnapshot string, so two
// snapshots compare on the locked part only; a non-JSON snapshot compares as it is.
export function lockedSnapshotPart(snapshot: string): string {
  try {
    const parsed = JSON.parse(snapshot) as Record<string, unknown>
    delete parsed.name
    return JSON.stringify(parsed)
  } catch {
    return snapshot
  }
}

// True when the editor changed anything the BE refuses on a system workflow (everything except the name).
export function systemLockedPartChanged(currentSnapshot: string, savedSnapshot: string): boolean {
  return lockedSnapshotPart(currentSnapshot) !== lockedSnapshotPart(savedSnapshot)
}

// Runs the system-workflow save through the caller's seams: PUT name + folder, patch those two fields on the
// row, close when asked. A refused PUT goes to the caller's failure path and resolves false (nothing applied).
export async function saveSystemWorkflow(updated: Workflow, closeAfter: boolean, deps: {
  put: (body: SystemWorkflowBody) => Promise<unknown>
  applyRow: (body: SystemWorkflowBody) => void
  close: () => void
  fail: (err: unknown) => void
}): Promise<boolean> {
  const body = systemWorkflowBody(updated)
  try {
    await deps.put(body)
  } catch (err) {
    deps.fail(err)
    return false
  }
  deps.applyRow(body)
  if (closeAfter) deps.close()
  return true
}
