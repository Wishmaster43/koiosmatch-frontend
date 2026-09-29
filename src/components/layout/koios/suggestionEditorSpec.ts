/**
 * suggestionEditorSpec — the pure field spec behind SuggestionEditor
 * (TASK-CREATE-EDIT-1, generalising RESCHEDULE-EDIT-1: "a way to adjust it
 * before running" applies to every Koios action, not only reschedule).
 * One entry per known action KEY, never per tool — several tools may share a
 * key's editor shape. Unknown key → no editor (today's plain stage flow),
 * EXCEPT the due_date fallback below, which keeps the pre-existing behaviour
 * for any action that carries a `due_date` but no recognised key yet.
 */

// The three field kinds an editor can render, in the order they appear.
export type EditorFieldKind = 'title' | 'due_date' | 'priority'
export interface EditorField { key: EditorFieldKind }

// Field spec per action key. `reschedule_task` mirrors the original
// RescheduleEditor exactly (date only); `create_task` adds title + priority
// on top (Danny 29-09: "due date en prio is toch ook belangrijk?").
export const EDITOR_FIELDS: Record<string, EditorField[]> = {
  reschedule_task: [{ key: 'due_date' }],
  create_task: [{ key: 'title' }, { key: 'due_date' }, { key: 'priority' }],
}

// Card title / confirm-button i18n key per resolved action key.
export const TITLE_KEY: Record<string, string> = {
  reschedule_task: 'koios.assistant.rescheduleTitle',
  create_task: 'koios.assistant.createTaskTitle',
}
export const CONFIRM_KEY: Record<string, string> = {
  reschedule_task: 'koios.assistant.rescheduleConfirm',
  create_task: 'koios.assistant.createTaskConfirm',
}

// The action key an editor actually renders as: the action's own key when it
// is a recognised one, else `reschedule_task` when the input carries a
// due_date (the pre-existing untagged-reschedule fallback), else none.
export function resolvedEditorKey(key: string | null | undefined, hasDueDate: boolean): string | undefined {
  if (key && EDITOR_FIELDS[key]) return key
  return hasDueDate ? 'reschedule_task' : undefined
}

// The fields for one action — see `resolvedEditorKey` for the resolution rule.
export function editorFieldsForAction(key: string | null | undefined, hasDueDate: boolean): EditorField[] | undefined {
  const rk = resolvedEditorKey(key, hasDueDate)
  return rk ? EDITOR_FIELDS[rk] : undefined
}
