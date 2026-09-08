/**
 * NotesTab — internal notes on a task (NT-TASK-1). Mirrors matches' NotesTab onto
 * the SAME shared NotesTab family (TaskCommentController validates `type` against
 * the entity=task note_types scope). The Reacties/comments thread tab was removed
 * 2026-07-14 for being an empty stub; this reinstates the surface as a proper
 * note-type-aware notes tab instead of the old plain-text thread. A task's detail
 * model (TaskDetail) carries no preloaded notes array, so this tab fetches its own
 * list once per task (GET /tasks/{id}/notes). The fetch/optimistic-add/retry
 * machinery is the SHARED `useEntityNotes` hook (NOTES-TWINS-1, §11) — identical to
 * the match tab. Rendering is shared via EntityNotesTab (NOTES-TWINS-2).
 */
import EntityNotesTab from '@/components/drawer/tabs/EntityNotesTab'
import type { TaskDetail } from '@/types/task'

// Internal notes on a task (see file docblock above): fetches its own list on
// mount and renders through the shared EntityNotesTab family.
export default function NotesTab({ task }: { task: TaskDetail }) {
  return <EntityNotesTab entity="task" id={String(task.id)} basePath={`/tasks/${task.id}`} ns="tasks" />
}
