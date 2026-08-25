/**
 * NotesTab — internal notes on a task (NT-TASK-1). Mirrors matches' NotesTab
 * onto the SAME shared NotesTab family (TaskCommentController validates `type`
 * against the entity=task note_types scope). The Reacties/comments thread tab
 * was removed 2026-07-14 for being an empty stub; this reinstates the surface
 * as a proper note-type-aware notes tab instead of the old plain-text thread.
 * A task's detail model (TaskDetail) carries no preloaded notes array, so this
 * tab fetches its own list once per task (GET /tasks/{id}/notes) — same
 * fetch-on-mount shape as the match tab.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import type { TaskDetail } from '@/types/task'

// Structural match for the shared NotesTab's NoteItem (typed fields + open index).
interface Note { type?: string; title?: string; author?: string; text?: string; body?: string; created_at?: string; [k: string]: unknown }

export default function NotesTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation(['tasks', 'common'])
  // Note categories from the tenant lookup, scoped to 'task' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('task')
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Freshness guard (§9): a monotonic request id, not just a boolean, since the
  // retry button can start a SECOND fetch while an earlier one is still in
  // flight — only the most recent request's response/error may land in state.
  const requestIdRef = useRef(0)

  // Detail-only data (§8): fetch this task's notes, callable from BOTH the
  // mount/task-switch effect below AND the load-error retry button (04-08), so
  // a retry re-runs the exact same request instead of a bespoke copy.
  const fetchNotes = useCallback(() => {
    if (task.id == null) { setLoading(false); return }
    const requestId = ++requestIdRef.current
    setLoading(true); setError(false)
    api.get(`/tasks/${task.id}/notes`)
      .then(r => { if (requestIdRef.current === requestId) setNotes(unwrapList<Note>(r).rows) })
      .catch(e => { if (requestIdRef.current === requestId && e?.response?.status !== 404) setError(true) })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false) })
  }, [task.id])
  // A failed/missing list degrades to the empty state, never a stuck spinner.
  useEffect(() => { fetchNotes() }, [fetchNotes])

  // Author avatar initials — the task's owner, else a Koios fallback.
  const ownerName = task.owner?.name || 'Koios'
  const initials = ownerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Optimistic add, then persist. OPTIMISTIC-REVERT-1 pattern (mirrors matches/
  // vacancies/applications): on failure the exact optimistic object is removed
  // again and the server's own message surfaced — never a silently-stuck fake note.
  // NOTE-TAAL-1: `payload` is forwarded to the API AS-IS, so the optional
  // `language` field rides along for free.
  const addNote = (payload: { type: string; title: string; body: string; language?: string }) => {
    const local: Note = { ...payload, text: payload.body, author: ownerName, created_at: new Date().toISOString() }
    setNotes(prev => [local, ...prev])
    if (task.id != null) {
      api.post(`/tasks/${task.id}/notes`, payload).catch(err => {
        setNotes(prev => prev.filter(n => n !== local))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }

  // Four UI states (§3): loading / error+retry (rendered by the SHARED tab, 04-08 —
  // `fetchNotes` doubles as the retry action) / empty (the shared tab's own
  // "notesEmpty" copy) / success.
  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 2px' }}>{t('notes.loading')}</div>
  }

  return (
    <SharedNotesTab
      notes={notes}
      error={error}
      onRetry={fetchNotes}
      onAddNote={addNote}
      noteTypes={noteTypes}
      authorInitials={initials}
      showTimeline={false}
      showConversations={false}
      labels={{
        notes: t('notes.title'),
        newNote: t('notes.new'),
        type: t('notes.type'),
        save: t('notes.save'),
        cancel: t('notes.cancel'),
        notesEmpty: t('notes.empty'),
        notePlaceholder: () => t('notes.placeholder'),
        searchPlaceholder: t('notes.searchPlaceholder'),
        loadError: t('notes.loadError'),
        retry: t('common:error.retry'),
      }}
    />
  )
}
