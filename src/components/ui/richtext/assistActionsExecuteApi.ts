/**
 * assistActionsExecuteApi — run or park the action items a rich-text Koios
 * assist call suggested, through the KoiosActionBridge (each executed item =
 * one workflow run, fully logged). Promoted out of the note domain
 * (CMFE-KOIOS-CONSISTENCY-1, Danny 09-08 "actiepunten... ontbreekt" on the
 * shared bar) so every rich-text field gets the SAME execute wizard, not a
 * note-only copy (§11 one source) — notes/noteActionsExecuteApi.ts is gone,
 * NoteAssistSection now calls straight into this file.
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
 *   types (K3, a different surface) — never reachable from a plain field's
 *   task/whatsapp/email/appointment/notification items, but handled here
 *   defensively (identically to `pending`) for forward compatibility.
 * - A 403 from the rights matrix becomes a per-item `forbidden` — one blocked
 *   item never sinks the whole batch. `unsupported` is documented by CMBE but
 *   NOT currently reachable per item: an item type outside the closed
 *   vocabulary fails the WHOLE request with a 422 instead (contract finding,
 *   already reported). Still rendered honestly if it ever appears.
 * - `run_id`/`template_key` are present only once `status === 'executed'`.
 * - CMBE 5961c673 (verified live 2026-08-07): every non-`executed` item also
 *   carries a `reason` string (`pending`/`wizard_required`/`forbidden`) — e.g.
 *   "Wacht op jouw bevestiging." or the rights-matrix exception message.
 *   These are plain server strings (not run through the tenant's i18n locale),
 *   shown as-is by the caller; the FE's own static per-type fallback covers
 *   only the case where `reason` is absent.
 * - `source` links the batch to where the items came from — TODAY the backend
 *   only recognises `note_id` (an existing note being edited); a field with no
 *   such linkage (a task/match description, or a new/unsaved note) sends `{}`.
 * - The request body also accepts `items[].message` (whatsapp/email draft
 *   text) and `items[].start` (appointment date-time) — both verified live to
 *   round-trip through `execute` unrejected; `toExecuteItem` forwards them
 *   from the assist-suggested item so a confirm never drops the AI's draft.
 */
import api from '@/lib/api'
import type { RichTextAssistActionItem, RichTextAssistActionType } from './richTextAssistApi'
import type { RunRow } from '@/types/reports'
import type { ActionBudget } from '@/types/actionBudget'

// K-153: a synchronously failed run reports 'failed' + reason — never a green
// 'executed' over a broken run. 'budget_exceeded' added PRIJSMODEL-C 30-08:
// the tenant's workflow-run staffel is full — never a retry, the reason +
// budget line render instead (see AssistActionItemCard).
export type ExecuteItemStatus = 'executed' | 'failed' | 'pending' | 'wizard_required' | 'forbidden' | 'unsupported' | 'budget_exceeded'

// One item sent to the execute endpoint — the assist-suggested item shape
// plus the per-item confirm flag (omit/false = preview, true = run it now).
export interface ExecuteRequestItem {
  title: string
  // K-159 (task items): who the task is for (omitted = the requester) and an
  // optional entity link from the full task-link vocabulary — all executed
  // verbatim by the bridge.
  assignee_user_id?: string
  link_type?: string
  link_id?: string
  type: RichTextAssistActionType
  due_date: string | null
  note_excerpt: string | null
  // Always sent explicitly (null when the item carries none), mirroring the
  // due_date/note_excerpt convention — never omitted for a "maybe" shape.
  message: string | null
  start: string | null
  confirmed?: boolean
}

export interface ExecuteResultItem {
  title: string
  type: RichTextAssistActionType
  status: ExecuteItemStatus
  // K-157: the record the sync run actually created — the ONLY linkable id
  // (run_id opens nothing in a drawer). Null for whatsapp/email/notification.
  created?: { type: 'appointment' | 'task' | 'calllist'; id: string } | null
  run_id?: string
  template_key?: string
  // Present on every non-'executed' status (pending/wizard_required/forbidden);
  // a raw server string, shown as-is — see the CONTRACT note above.
  reason?: string
  // PRIJSMODEL-C 30-08: present only on status === 'budget_exceeded' — the
  // staffel stand (state/allowance/used/remaining/unit/upgrade_hint), no price.
  budget?: ActionBudget
}

export interface ExecuteSource {
  // Present when composing over an EXISTING note (edit mode); omitted for a
  // new, unsaved note OR any non-note field — no linkage exists there yet.
  note_id?: string
}

// Narrow a RichTextAssistActionItem down to exactly the fields the execute
// endpoint validates — never forward extra local UI state into the request
// body. message/start default to null (never undefined) so a pre-CMBE
// fixture that lacks them still produces the same explicit shape.
export function toExecuteItem(item: RichTextAssistActionItem, confirmed?: boolean): ExecuteRequestItem {
  return {
    title: item.title, type: item.type, due_date: item.due_date, note_excerpt: item.note_excerpt,
    message: item.message ?? null, start: item.start ?? null, confirmed,
    // K-159: only when set — an omitted assignee falls back to the requester
    // server-side, and an absent link simply links nothing.
    ...(item.assignee_user_id ? { assignee_user_id: item.assignee_user_id } : null),
    ...(item.link_type && item.link_id ? { link_type: item.link_type, link_id: item.link_id } : null),
    // NOTE-ACTION-ITEMS-1: with the persisted row id (plus source.note_id) the
    // server stamps status/created onto the stored item — IDOR-safe pair.
    ...((item as { noteActionItemId?: string }).noteActionItemId
      ? { note_action_item_id: (item as { noteActionItemId?: string }).noteActionItemId } : null),
  }
}

/**
 * POST /ai/koios/notes/actions/execute — run/park a batch of action items.
 * Called explicitly by the "Uitvoeren" button (preview, no items confirmed)
 * and again per item on its own "Bevestigen" click (confirmed:true) — never
 * automatically (§0 no fake affordances: nothing executes without a click).
 */
export async function executeRichTextActions(
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
