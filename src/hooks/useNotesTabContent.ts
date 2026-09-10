/**
 * useNotesTabContent — shared hook for notes tabs (contact, location, department).
 * Abstracts the common write-path patterns: add/edit/delete a note through the
 * customer notes endpoint, and the author-initials computation. Note-type
 * vocabulary resolution stays OUT of this hook and lives in each consumer,
 * which calls exactly one of useNoteTypes/useNoteTypesFor (never both — a
 * single shared call site cannot pick one over the other without firing both
 * requests unconditionally, see ContactNotesTab/ScopedNotesTab). loading/error
 * likewise stay with the caller's own scoped-fetch hook: neither consumer
 * reads them back off this hook.
 */
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import type { Id } from '@/types/common'

interface NoteRow { id?: Id }

interface UseNotesTabContentProps<T extends NoteRow> {
  // The scoped notes list (used to resolve a note's id from its row index) and refresh callback
  notes: T[]
  reload: () => void

  // The custom ID for the parent record (e.g. customerId)
  customerId?: Id

  // Payload shape when creating notes: the scoped fields to send
  // e.g. { customer_contact_id: id } or { customer_location_id: id, customer_department_id: id }
  createPayloadFields: Record<string, unknown>

  // API endpoint for POST/PATCH/DELETE notes
  // Usually /customers/{customerId}/notes, supplied by caller
  apiEndpoint: string
}

interface UseNotesTabContentResult {
  authorInitials: string

  addNote: (payload: { type: string; title: string; body: string; language?: string }) => void
  editNote: (index: number, payload: { type: string; title: string; body: string; language?: string }) => void
  deleteNote: (index: number) => void
}

export function useNotesTabContent<T extends NoteRow>({
  notes, reload, customerId, createPayloadFields, apiEndpoint,
}: UseNotesTabContentProps<T>): UseNotesTabContentResult {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const authorInitials = initialsOf(auth?.user?.name ?? '')

  // Pinned to THIS scope — writes through the same endpoint the customer-level
  // composer uses (CustomerController::addNote), just with the scope field preset
  // (customer_contact_id / customer_location_id / customer_department_id).
  // NOTE-TAAL-1: `language` rides along optionally, same as the customer-level composer.
  const addNote = (payload: { type: string; title: string; body: string; language?: string }) => {
    if (!customerId) return
    api.post(apiEndpoint, {
      type: payload.type,
      title: payload.title,
      text: payload.body,
      language: payload.language,
      ...createPayloadFields,
    }).then(reload)
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // NOTITIE-PARITEIT (Danny 27-08): the note's own id lives in the shared customer
  // note table regardless of scope, so the customer-level PATCH/DELETE routes
  // (CustomerController::updateNote/destroyNote) work here unchanged — no scope
  // field to resend, just the note id resolved from its row index.
  const editNote = (index: number, payload: { type: string; title: string; body: string; language?: string }) => {
    const noteId = notes[index]?.id
    if (!customerId || noteId == null) return
    api.patch(`${apiEndpoint}/${noteId}`, {
      type: payload.type,
      title: payload.title,
      text: payload.body,
      language: payload.language,
    }).then(reload)
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // Delete by row index through the same scope-agnostic customer-level route.
  const deleteNote = (index: number) => {
    const noteId = notes[index]?.id
    if (!customerId || noteId == null) return
    api.delete(`${apiEndpoint}/${noteId}`)
      .then(reload)
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  return {
    authorInitials,
    addNote,
    editNote,
    deleteNote,
  }
}
