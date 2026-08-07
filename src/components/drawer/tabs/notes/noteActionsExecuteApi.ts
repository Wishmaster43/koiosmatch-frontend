/**
 * noteActionsExecuteApi — K0-B (KOIOS-SLIM O-18 §1.3): run or park the action
 * items note-assist suggested, through the KoiosActionBridge (each executed
 * item = one workflow run, fully logged). Hand-written types (§10): this route
 * has no openapi-typescript entry yet.
 *
 * CONTRACT (verified live against KoiosActionExecuteController + the running
 * API, 2026-08-07 — supersedes the earlier batch-level `confirmed` flag from
 * the original K0 briefing):
 * - Confirmation is PER ITEM: `items[].confirmed`, never a request-level flag
 *   over the whole batch. Re-send only the item(s) being confirmed.
 * - Response status per item: `executed | pending | wizard_required |
 *   forbidden | unsupported`. Wizard mode returns every non-confirmed item as
 *   `pending`; Auto mode runs everything directly except whatsapp/email
 *   (stay `pending` unless the user's `auto_messages` opt-in is on).
 *   `wizard_required` is reserved for the application_* selection-decision
 *   types (K3, a different surface) — never reachable from a note's
 *   task/whatsapp/email/appointment/notification items, but handled here
 *   defensively (identically to `pending`) for forward compatibility.
 * - A 403 from the rights matrix becomes a per-item `forbidden` — one blocked
 *   item never sinks the whole batch. `unsupported` is documented by CMBE but
 *   NOT currently reachable per item: an item type outside the closed
 *   vocabulary fails the WHOLE request with a 422 instead (contract finding,
 *   reported — see the task's final report). Still rendered honestly if it
 *   ever appears.
 * - `run_id`/`template_key` are present only once `status === 'executed'`.
 */
import api from '@/lib/api'
import type { AssistActionItem, AssistActionType } from './noteAssistApi'
import type { RunRow } from '@/types/reports'

export type ExecuteItemStatus = 'executed' | 'pending' | 'wizard_required' | 'forbidden' | 'unsupported'

// One item sent to the execute endpoint — the note-assist suggestion shape
// plus the per-item confirm flag (omit/false = preview, true = run it now).
export interface ExecuteRequestItem {
  title: string
  type: AssistActionType
  due_date: string | null
  note_excerpt: string | null
  confirmed?: boolean
}

export interface ExecuteResultItem {
  title: string
  type: AssistActionType
  status: ExecuteItemStatus
  run_id?: string
  template_key?: string
}

export interface ExecuteSource {
  // Present when composing over an EXISTING note (edit mode); omitted for a
  // new, unsaved note — mirrors the note-id-source rule from the task brief.
  note_id?: string
}

// Narrow an AssistActionItem down to exactly the fields the execute endpoint
// validates — never forward extra local UI state into the request body.
export function toExecuteItem(item: AssistActionItem, confirmed?: boolean): ExecuteRequestItem {
  return { title: item.title, type: item.type, due_date: item.due_date, note_excerpt: item.note_excerpt, confirmed }
}

/**
 * POST /ai/koios/notes/actions/execute — run/park a batch of action items.
 * Called explicitly by the "Uitvoeren" button (preview, no items confirmed)
 * and again per item on its own "Bevestigen" click (confirmed:true) — never
 * automatically (§0 no fake affordances: nothing executes without a click).
 */
export async function executeNoteActions(
  items: ExecuteRequestItem[],
  source: ExecuteSource = {},
  signal?: AbortSignal,
): Promise<ExecuteResultItem[]> {
  const res = await api.post<{ items: ExecuteResultItem[] }>(
    '/ai/koios/notes/actions/execute',
    { items, source },
    { signal },
  )
  return res.data.items ?? []
}

/**
 * GET /workflow-runs/{id} — the single-run read (verified live) used to open
 * the shared RunDetailDrawer for an executed item's `run_id`; the execute
 * response carries only the id, not the full run row the drawer needs.
 */
export async function fetchWorkflowRun(runId: string, signal?: AbortSignal): Promise<RunRow> {
  const res = await api.get<RunRow>(`/workflow-runs/${runId}`, { signal })
  return res.data
}
