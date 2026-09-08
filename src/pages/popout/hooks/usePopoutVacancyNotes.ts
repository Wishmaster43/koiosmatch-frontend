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
import { landedWrite } from './popoutNoteWrite'
import { actionItemsWire } from '@/components/drawer/tabs/notes/notesTabTypes'
import type { NoteActionItemWire } from '@/components/drawer/tabs/NotesTab'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'

// Structural match for the shared NotesTab's NoteItem (mirrors vacancies/drawer/NotesTab.tsx's own Note type).
// action_items (X-34): persisted panel items, returned on read, omitted on write when absent.
export interface PopoutVacancyNote { type?: string; title?: string; author?: string; text?: string; body?: string; created_at?: string; action_items?: NoteActionItemWire[] | null; [k: string]: unknown }
interface NotePayload { type: string; title: string; body: string; language?: string; action_items?: NoteActionItemWire[] }

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
  // NOTE-ACTION-ITEMS-1: forward the action_items panel only when present (present = the full wanted set; absent = untouched).
  const addNote = useCallback((payload: NotePayload) => {
    if (!vacancyId) return
    const local: PopoutVacancyNote = { ...payload, text: payload.body, author: authorName, created_at: new Date().toISOString() }
    setNotes(prev => [local, ...prev])
    api.post(`/vacancies/${vacancyId}/notes`, { type: payload.type, title: payload.title, body: payload.body, language: payload.language,
      ...actionItemsWire(payload.action_items) })
      .then(() => load())
      .catch(err => {
        setNotes(prev => prev.filter(n => n !== local))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [vacancyId, authorName, load, t])

  // Edit — index into the current list, optimistic + PATCH (drawer NotesTab payload
  // shape: `{...payload, text: body}`) + reload; reverts to the snapshot on failure.
  // Resolves TRUE only on a landed write (PopoutSaveFooter's honest-signal contract).
  // NOTE-ACTION-ITEMS-1: forward the action_items panel only when present (present = the full wanted set; absent = untouched).
  const editNote = useCallback((index: number, payload: NotePayload): Promise<boolean> => {
    if (!vacancyId) return Promise.resolve(false)
    const target = notes[index]
    if (!target || target.id == null) return Promise.resolve(false)
    const snapshot = notes
    setNotes(prev => prev.map((n, i) => (i === index ? { ...n, type: payload.type, title: payload.title, text: payload.body } : n)))
    return landedWrite(
      api.patch(`/vacancies/${vacancyId}/notes/${target.id}`, { type: payload.type, title: payload.title, body: payload.body, text: payload.body, language: payload.language, ...actionItemsWire(payload.action_items) }),
      load, () => setNotes(snapshot), t)
  }, [vacancyId, notes, load, t])

  // Delete — optimistic remove with revert (mirrors the customer popout hook).
  const deleteNote = useCallback((index: number) => {
    if (!vacancyId) return
    const target = notes[index]
    if (!target || target.id == null) return
    const snapshot = notes
    setNotes(prev => prev.filter((_, i) => i !== index))
    api.delete(`/vacancies/${vacancyId}/notes/${target.id}`)
      .catch(err => {
        setNotes(snapshot)
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [vacancyId, notes, t])

  return { notes, addNote, editNote, deleteNote }
}
