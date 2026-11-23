/**
 * koiosToolResult — the record a confirmed Koios tool CREATED, as a deep-link ref
 * (§0B "a link to the record it created"; Danny 09-09: "Execute does nothing … I'm
 * missing the hyperlinks to the created tasks"). Pure mapper over the tool's own result body
 * (ToolExecutor::executePending hands the tool result back under `data`), so the
 * assistant block and the pending-action card render the SAME chip.
 */
import type { KoiosContextRef } from '@/types/koios'
import { pick } from './koiosToolIds'

// A tool result → the created record's ref, or null when the tool created nothing
// we can link (search tools, refusals, older shapes).
export function createdRefFromToolResult(data: unknown, fallbackLabel: string): KoiosContextRef | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const ok = pick<boolean>(d, 'ok', 'gelukt')
  if (ok === false) return null
  // create_task → { ok, task_id, title, due_date }: the result keys are English-only since
  // KOIOS-TOOL-RESULT-KEYS-1 (BE batch H); `ok` keeps its Dutch twin until KOIOS-TOOL-RESULT-KEYS-2.
  const taskId = d.task_id
  if (taskId != null && taskId !== '') {
    const title = d.title
    return { type: 'task', id: String(taskId), label: typeof title === 'string' && title ? title : fallbackLabel }
  }
  // CALLLIST-KEY-1: create_call_list → { ok, call_list_id, name, reused, warnings[] }.
  // Keys are English-only (CALLLIST-KEY-1 round 1 already removed the Dutch twins).
  // A REUSED list is still a valid created-record chip; only `ok === false` links nothing.
  const callListId = d.call_list_id
  if (callListId != null && callListId !== '') {
    const name = d.name
    return { type: 'calllist', id: String(callListId), label: typeof name === 'string' && name ? name : fallbackLabel }
  }
  return null
}
