/**
 * useApplicationNotes — internal notes on ONE application
 * (POST /applications/{id}/notes, ApplicationController::storeNote). There is no
 * GET/PATCH/DELETE route for application notes (verified 07-08 in
 * routes/api/tenant/applications-matches.php: only the POST exists) — notes ride
 * along inside the application detail payload, so this hook seeds from that list
 * and is add-only (no edit/delete affordance is offered anywhere upstream — §3,
 * no fake affordance for a persistence path that does not exist).
 *
 * TIMESTAMP-1 (07-08): mapApplicationDetail's notes carry the date under `time`
 * (matching the rest of ApplicationDetail's sub-lists, e.g. `timeline`), but the
 * shared NotesTab's NoteItem reads `created_at` — the drawer's own local `Note`
 * type declared `created_at` while `a.notes` actually holds `time`, so every
 * FETCHED note rendered with no date at all (only the optimistic entry, which
 * set neither, fell back to the "just now" `ago` string forever). Seeding here
 * re-keys `time` → `created_at` once, at this one boundary.
 *
 * AUTHOR-1 (07-08): the optimistic note used to credit `application.owner` (the
 * ASSIGNED RECRUITER) instead of the person actually typing the note — fixed to
 * use the LOGGED-IN user (useAuth), the same rule useCandidateNotes follows.
 * `author_id` is set from the logged-in user for shape-parity with the candidate/
 * customer note contract, though verified live (07-08) the backend never returns
 * `author_id` on a fetched application note — only `id/type/title/author/text/
 * language/created_at` (ApplicationDetailResource::applicationNotes()). Its own
 * `author` resolution is ALSO broken server-side (`ownerNames` is referenced but
 * never populated by the controller, so a saved note's `author` reads back null
 * even for a real user) — filed for backend, out of scope for this repo.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

// The shape the shared NotesTab (components/drawer/tabs/NotesTab.tsx) renders —
// `created_at`, not `time` (see TIMESTAMP-1 above).
export interface ApplicationNote {
  id?: Id
  type?: string
  title?: string
  author?: string
  // Present only on the OPTIMISTIC entry (see AUTHOR-1 above) — undefined on any
  // note that came back from the server, which is what keeps the shared NotesTab's
  // canManageNote() permissive for fetched notes (no BE edit/delete route exists
  // yet, so nothing should ever appear manageable there).
  author_id?: Id | null
  text?: string
  language?: string
  created_at?: string
  // The shared NoteItem type carries an index signature (author_name/created_by/…
  // it also reads) — mirrored here so this narrower shape stays assignable to it.
  [k: string]: unknown
}

// The composer payload the shared NotesTab hands back on save.
interface NotePayload { type: string; title: string; body: string; language?: string }

export function useApplicationNotes(applicationId: Id | undefined, initialNotes: ApplicationDetail['notes']) {
  const { t } = useTranslation()
  const { user } = useAuth() ?? {}
  const [notes, setNotes] = useState<ApplicationNote[]>(
    initialNotes.map(n => ({ id: n.id, type: n.type, title: n.title, author: n.author, text: n.text, language: n.language, created_at: n.time })),
  )

  // Optimistic prepend credited to the LOGGED-IN user, then a real POST. On
  // failure the exact optimistic object is removed again (reference match, safe
  // even if more notes were added meanwhile) and the server's own message
  // surfaces — mirrors useCandidateNotes' OPTIMISTIC-REVERT-1 fix so a failed
  // note never lingers on screen as if it had saved.
  const addNote = useCallback((payload: NotePayload) => {
    if (!applicationId) return
    const local: ApplicationNote = {
      id: `tmp-${Date.now()}`,
      type: payload.type, title: payload.title, text: payload.body, language: payload.language,
      author: user?.name ?? 'Koios',
      author_id: user?.id ?? null,
      created_at: new Date().toISOString(),
    }
    setNotes(prev => [local, ...prev])
    api.post(`/applications/${applicationId}/notes`, payload).catch(err => {
      setNotes(prev => prev.filter(n => n !== local))
      notifyError(extractApiError(err, t('common:actionFailed')))
    })
  }, [applicationId, user, t])

  return { notes, addNote }
}
