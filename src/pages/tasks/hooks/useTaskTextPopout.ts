/**
 * useTaskTextPopout — TAKEN 2 (walkthrough 21-08): the second-screen plumbing
 * for the task description, mirroring useMatchTextPopout/useVacancyTextPopout
 * 1:1 via the shared useLiteTextPopout plumbing — a light identity fetch for
 * the popped-out window (a separate render tree with no access to the drawer's
 * own state) plus a standalone PATCH /tasks/{id} on the SAME `description`
 * field the drawer's own DetailsTab writes through useTaskDrawerActions.handleUpdate.
 */
import { initialsOf } from '@/lib/initials'
import { useLiteTextRecord, patchLiteText } from '@/hooks/useLiteTextPopout'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

export interface TaskTextLite { id: string; title: string; initials: string; description: string }

// The subset of the raw task resource this popout actually reads.
interface RawTaskLite { id?: Id; title?: string; name?: string; description?: string | null }

// Mapper: fetch and build the TaskTextLite from the raw response.
function mapTaskTextLite(raw: RawTaskLite, id: string): TaskTextLite {
  const title = raw.title ?? raw.name ?? '?'
  // 'T' fallback mirrors TaskDrawer's own header avatar (initialsOf(task.title, 'T')).
  return {
    id: String(raw.id ?? id),
    title,
    initials: initialsOf(title, 'T'),
    description: raw.description ?? ''
  }
}

// Light identity fetch for the popped-out task-description window.
export function useTaskTextLite(id: string | undefined) {
  const { record: task, loading, error, reload } = useLiteTextRecord(id, '/tasks', mapTaskTextLite)
  return { task, loading, error, reload }
}

// Standalone PATCH /tasks/{id} — same field the drawer's own DetailsTab writes
// (`description`, via useTaskDrawerActions.handleUpdate). MEASURED (21-08):
// that handler forwards `patch.description` as-is, never nulling an empty
// string — unlike useMatchTextPopout's `match_text`, which the drawer DOES
// null on empty. Mirrored exactly here, not copy-pasted from the match recipe.
export function patchTaskText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return patchLiteText('/tasks', id, 'description', html, t, revert, false)
}
