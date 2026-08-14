/**
 * useApplicationNotes — internal notes on ONE application
 * (POST /applications/{id}/notes, ApplicationController::storeNote). There is
 * still no GET/DELETE route for application notes, so this hook seeds from the
 * application detail payload passed in by the drawer, not its own fetch — but
 * A-popout-1 (verified live in routes/api/tenant/applications-matches.php,
 * 14-08) added `PATCH /applications/{id}/notes/{note}`
 * (ApplicationController::updateNote), so `editNote` below is real: an
 * optimistic in-place update, then the PATCH, reverted on failure. Still no
 * delete affordance (§3, no route to back it).
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
 * `author_id` is set from the logged-in user on the optimistic entry.
 *
 * NOTE-AUTHOR-SHAPE-2 (verified live 2026-08-07, CMBE 5961c673): a FETCHED/seeded
 * note now carries a real `author_id` too — the backend's `ownerNames` map
 * (previously referenced but never filled, so `author` always read back null) is
 * populated, and the resource emits `author_id` on every note. Seeding below reads
 * it off `mapApplicationDetail`'s `authorId` field, so every note in `notes` — not
 * just the optimistic one — carries a real key, which is what lets the shared
 * NotesTab's canManageNote() rights gate engage (an explicit id, not `undefined`,
 * is required for the gate to run at all — see that file's RIGHTS doc comment).
 * No edit/delete route exists for application notes yet (only POST — verified in
 * routes/api/tenant/applications-matches.php), so no fake affordance is added
 * here (§3): the data is now correct and gate-ready, but nothing renders the
 * edit/delete buttons that would exercise it until that route ships.
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
  // NOTE-AUTHOR-SHAPE-2: present on BOTH the optimistic entry (the logged-in user)
  // and every seeded/fetched note (the backend's resolved author_id) — see the
  // header doc comment above. A real value here (never left undefined) is what
  // makes the shared NotesTab's canManageNote() rights gate engage instead of
  // falling back to its permissive "not migrated" default.
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
  // NOTE-AUTHOR-SHAPE-2: authorId (mapApplicationDetail's key) re-keys to author_id
  // here too — the shared NotesTab's NoteItem reads `author_id`, not `authorId`.
  const [notes, setNotes] = useState<ApplicationNote[]>(
    initialNotes.map(n => ({
      id: n.id, type: n.type, title: n.title, author: n.author, author_id: n.authorId ?? null,
      text: n.text, language: n.language, created_at: n.time,
    })),
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

  // Edit — NotesTab passes a list index; optimistic in-place update, then the
  // real PATCH (A-popout-1), reverted on failure (mirrors useCandidateNotes'
  // editNote). Returns whether the write landed — NOTITIE-POPOUT-URL-1's
  // per-note window awaits this before closing itself; the drawer tab ignores
  // the promise, same as every other host.
  const editNote = useCallback((index: number, payload: NotePayload): Promise<boolean> => {
    if (!applicationId) return Promise.resolve(false)
    const target = notes[index]
    if (!target) return Promise.resolve(false)
    const snapshot = notes
    setNotes(prev => prev.map((n, i) => (i === index
      ? { ...n, type: payload.type, title: payload.title, text: payload.body, language: payload.language }
      : n)))
    return api.patch(`/applications/${applicationId}/notes/${target.id}`, payload)
      .then(() => true)
      .catch(err => {
        setNotes(snapshot)
        notifyError(extractApiError(err, t('common:actionFailed')))
        return false
      })
  }, [applicationId, notes, t])

  return { notes, addNote, editNote }
}
