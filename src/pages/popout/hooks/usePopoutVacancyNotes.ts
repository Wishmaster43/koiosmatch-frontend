/**
 * usePopoutVacancyNotes — the vacancy's note thread for the second-screen popout
 * (F5-uitbreiding). vacancies/drawer/NotesTab.tsx seeds its list from the already-
 * loaded VacancyDetail's embedded `notes[]` (no fetch of its own); the popout has
 * no full detail load (LITE fetch only, see useVacancyLite), so this hook adds the
 * one thing the drawer doesn't need: GET /vacancies/{id}/notes on mount. The add
 * flow mirrors NotesTab.tsx's OPTIMISTIC-REVERT-1 pattern (no PATCH exists for a
 * single vacancy note — only add/delete — and the drawer wires add only, so this
 * hook does too).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'

// Structural match for the shared NotesTab's NoteItem (mirrors vacancies/drawer/NotesTab.tsx's own Note type).
export interface PopoutVacancyNote { type?: string; title?: string; author?: string; text?: string; body?: string; created_at?: string; [k: string]: unknown }
interface NotePayload { type: string; title: string; body: string; language?: string }

export function usePopoutVacancyNotes(vacancyId: string | undefined, authorName: string) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<PopoutVacancyNote[]>([])

  // One loader — the effect uses it, and a successful add re-fetches so the real
  // id/author/timestamp show (mirrors useCandidateNotes' reload-after-write pattern).
  const load = useCallback(() => {
    if (!vacancyId) { setNotes([]); return }
    api.get(`/vacancies/${vacancyId}/notes`)
      .then(res => setNotes(unwrapList<PopoutVacancyNote>(res).rows))
      .catch(() => setNotes([]))
  }, [vacancyId])

  useEffect(() => { load() }, [load])

  // Optimistic add, then persist. NOTE-TAAL-1: `payload` is forwarded to the API
  // AS-IS (mirrors NotesTab.tsx), so the optional `language` field rides along for free.
  const addNote = useCallback((payload: NotePayload) => {
    if (!vacancyId) return
    const local: PopoutVacancyNote = { ...payload, text: payload.body, author: authorName, created_at: new Date().toISOString() }
    setNotes(prev => [local, ...prev])
    api.post(`/vacancies/${vacancyId}/notes`, payload)
      .then(() => load())
      .catch(err => {
        setNotes(prev => prev.filter(n => n !== local))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [vacancyId, authorName, load, t])

  return { notes, addNote }
}
