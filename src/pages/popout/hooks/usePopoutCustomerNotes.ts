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
import { mapCustomerNoteRow, type ApiCustomerNoteRow } from '@/pages/customers/data/mapCustomer'
import type { CustomerNote } from '@/types/customer'

// NotesTab hands back the editor payload on save (add only — the API has no
// PATCH for a single customer note, mirrors CustomerNotesTab's own onAddNote-only wiring).
interface NotePayload { type: string; title: string; body: string; language?: string }

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

  return { notes, addNote }
}
