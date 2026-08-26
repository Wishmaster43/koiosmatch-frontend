/**
 * usePopoutApplicationNotes — the application's note thread for the second-screen
 * popout (A-popout-1). No standalone `GET /applications/{id}/notes` route exists
 * (verified in routes/api/tenant/applications-matches.php — notes ride along
 * inside the application detail payload, same as useApplicationNotes.ts's own
 * comment documents), so this reloads the whole application on mount and after
 * every write and re-reads `raw.notes`. `POST …/notes` (add) and, since
 * A-popout-1, `PATCH …/notes/{note}` (edit) both exist — no DELETE route, so no
 * delete affordance is offered here (§3, no fake affordance).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { Id } from '@/types/common'

// Structural match for the shared NotesTab's NoteItem — mirrors mapApplication.ts's
// own notes mapping (author_id → authorId so canManageNote's rights gate engages).
export interface PopoutApplicationNote {
  id?: Id; author?: string; author_id?: Id | null; type?: string; title?: string
  text?: string; language?: string; created_at?: string; [k: string]: unknown
}
interface NotePayload { type: string; title: string; body: string; language?: string }
interface RawApplicationNotes { notes?: Array<{ id?: Id; author?: string; author_id?: Id | null; type?: string; title?: string | null; text?: string; language?: string | null; created_at?: string }> }

// See the file's top doc above; since notes ride along inside the application payload, this reloads the whole application on mount and after every write.
export function usePopoutApplicationNotes(applicationId: Id | undefined) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<PopoutApplicationNote[]>([])

  // One loader — the effect uses it, and a successful add/edit re-fetches so the
  // real id/author/timestamp show (mirrors usePopoutVacancyNotes' reload pattern).
  const load = useCallback(() => {
    if (!applicationId) { setNotes([]); return }
    api.get(`/applications/${applicationId}`)
      .then(res => {
        const raw = unwrap<RawApplicationNotes>(res)
        setNotes((raw.notes ?? []).map(n => ({
          id: n.id, author: n.author ?? '', author_id: n.author_id ?? null, type: n.type ?? '',
          title: n.title ?? '', text: n.text ?? '', language: n.language ?? '', created_at: n.created_at ?? '',
        })))
      })
      .catch(() => setNotes([]))
  }, [applicationId])

  useEffect(() => { load() }, [load])

  // Optimistic add, then persist (mirrors usePopoutVacancyNotes' add flow).
  const addNote = useCallback((payload: NotePayload) => {
    if (!applicationId) return
    const local: PopoutApplicationNote = { ...payload, text: payload.body, created_at: new Date().toISOString() }
    setNotes(prev => [local, ...prev])
    api.post(`/applications/${applicationId}/notes`, payload)
      .then(() => load())
      .catch(err => {
        setNotes(prev => prev.filter(n => n !== local))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [applicationId, load, t])

  // A-popout-1: edit an existing note — index into the current `notes` array,
  // optimistic + PATCH + reload (mirrors usePopoutCustomerNotes.editNote).
  // Returns whether the write landed (NOTITIE-POPOUT-URL-1 / PopoutSaveFooter's
  // contract: "save and close" only closes on a landed write) — the whole-thread
  // window (ApplicationNotesPopout) ignores the promise, same as every other host.
  const editNote = useCallback((index: number, payload: NotePayload): Promise<boolean> => {
    if (!applicationId) return Promise.resolve(false)
    const target = notes[index]
    if (!target?.id) return Promise.resolve(false)
    const snapshot = notes
    setNotes(prev => prev.map((n, i) => (i === index ? { ...n, type: payload.type, text: payload.body, language: payload.language } : n)))
    return api.patch(`/applications/${applicationId}/notes/${target.id}`, payload)
      .then(() => { load(); return true })
      .catch(err => {
        setNotes(snapshot)
        notifyError(extractApiError(err, t('common:actionFailed')))
        return false
      })
  }, [applicationId, notes, load, t])

  return { notes, addNote, editNote }
}
