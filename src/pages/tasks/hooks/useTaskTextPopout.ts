/**
 * useTaskTextPopout — TAKEN 2 (walkthrough 21-08): the second-screen plumbing
 * for the task description, mirroring useMatchTextPopout/useVacancyTextPopout
 * 1:1 — a light identity fetch for the popped-out window (a separate render
 * tree with no access to the drawer's own state) plus a standalone PATCH
 * /tasks/{id} on the SAME `description` field the drawer's own DetailsTab
 * writes through useTaskDrawerActions.handleUpdate.
 */
import { useCallback } from 'react'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useLiteRecord } from '@/hooks/useLiteRecord'
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
  // Fetch and map in one stable callback so useLiteRecord's effect stays single-run per id.
  const fetchRecord = useCallback(
    (taskId: string) => api.get(`/tasks/${taskId}`).then(r => {
      const raw = unwrap<RawTaskLite>(r)
      return mapTaskTextLite(raw, taskId)
    }),
    []
  )
  const { record: task, loading, error, reload } = useLiteRecord(id, fetchRecord)
  return { task, loading, error, reload }
}

// Standalone PATCH /tasks/{id} — same field the drawer's own DetailsTab writes
// (`description`, via useTaskDrawerActions.handleUpdate). MEASURED (21-08):
// that handler forwards `patch.description` as-is, never nulling an empty
// string — unlike useMatchTextPopout's `match_text`, which the drawer DOES
// null on empty. Mirrored exactly here, not copy-pasted from the match recipe.
export function patchTaskText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/tasks/${id}`, { description: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
