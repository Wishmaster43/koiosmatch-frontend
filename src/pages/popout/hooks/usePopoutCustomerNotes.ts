/**
 * usePopoutCustomerNotes — the customer's note thread for the second-screen popout
 * (F5-uitbreiding). Mirrors CustomerNotesTab/useCustomerRecord's add-note wiring,
 * scoped down to what a standalone popout window needs: no list/detail state to
 * reconcile, no location/department/contact link picker — the popout intentionally
 * shows a notes-only surface, the same simplification the candidate popout already
 * makes by dropping timeline/conversations/tasks/consent.
 *
 * Reads via the dedicated notes-list endpoint with `?rollup=1` so location/
 * department-linked notes still show (read-parity with the drawer's embedded
 * `customer.notes[]`, CustomerController::notes) — only the ADD flow drops the
 * link picker, never the read.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { mapCustomerNoteRow, type ApiCustomerNoteRow } from '@/pages/customers/shared'
import type { CustomerNote } from '@/types/customer'

// NotesTab hands back the editor payload on save (add/edit share this shape).
// K15NOTES: PATCH/DELETE /customers/{id}/notes/{note} now exist — this hook mirrors
// useCandidateNotes' index-based edit/delete instead of staying add-only.
interface NotePayload { type: string; title: string; body: string; language?: string }

// Notes CRUD for the customer notes popout window, mirroring useCandidateNotes'
// index-based edit/delete (see the module doc comment above).
export function usePopoutCustomerNotes(customerId: string | undefined) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<CustomerNote[]>([])

  // One loader — the effect uses it, and a successful add re-fetches so the real
  // id/author/timestamp show (mirrors useCandidateNotes' reload-after-write pattern).
  const load = useCallback(() => {
    if (!customerId) { setNotes([]); return }
    api.get(`/customers/${customerId}/notes`, { params: { rollup: 1 } })
      .then(res => setNotes(unwrapList<ApiCustomerNoteRow>(res).rows.map(mapCustomerNoteRow)))
      .catch(() => setNotes([]))
  }, [customerId])

  useEffect(() => { load() }, [load])

  // Create — optimistic prepend, then POST + reload. OPTIMISTIC-REVERT-1 pattern:
  // on failure the optimistic entry is removed again and the server's own message
  // surfaced — never a silently-stuck fake note.
  const addNote = useCallback((payload: NotePayload) => {
    if (!customerId) return
    const temp: CustomerNote = {
      id: `tmp-${Date.now()}`, type: payload.type, title: '', text: payload.body, ago: new Date().toISOString(),
      contactId: null, contactName: '', locationId: null, locationName: '', departmentId: null, departmentName: '', level: '',
    }
    setNotes(prev => [temp, ...prev])
    api.post(`/customers/${customerId}/notes`, { type: payload.type, text: payload.body, language: payload.language })
      .then(() => load())
      .catch(err => {
        setNotes(prev => prev.filter(n => n.id !== temp.id))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [customerId, load, t])

  // K15NOTES: edit — index into the current `notes` array, optimistic + PATCH + reload
  // (mirrors useCandidateNotes.editNote). Reverts to the pre-edit snapshot on failure.
  // POPOUT-PARITEIT-1: resolves TRUE only on a landed write — the per-note popout's
  // PopoutSaveFooter contract requires an honest signal (§3).
  const editNote = useCallback((index: number, payload: NotePayload): Promise<boolean> => {
    if (!customerId) return Promise.resolve(false)
    const target = notes[index]
    if (!target) return Promise.resolve(false)
    const snapshot = notes
    setNotes(prev => prev.map((n, i) => (i === index ? { ...n, type: payload.type, text: payload.body } : n)))
    return api.patch(`/customers/${customerId}/notes/${target.id}`, { type: payload.type, text: payload.body, language: payload.language })
      .then(() => { load(); return true })
      .catch(err => {
        setNotes(snapshot)
        notifyError(extractApiError(err, t('common:actionFailed')))
        return false
      })
  }, [customerId, notes, load, t])

  // K15NOTES: delete — optimistic remove with revert (mirrors useCandidateNotes.deleteNote).
  const deleteNote = useCallback((index: number) => {
    if (!customerId) return
    const target = notes[index]
    if (!target) return
    const snapshot = notes
    setNotes(prev => prev.filter((_, i) => i !== index))
    api.delete(`/customers/${customerId}/notes/${target.id}`)
      .catch(err => {
        setNotes(snapshot)
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [customerId, notes, t])

  return { notes, addNote, editNote, deleteNote }
}
