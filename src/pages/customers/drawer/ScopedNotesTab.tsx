/**
 * ScopedNotesTab — the location/department drill-down's OWN Notities sub-tab
 * (NOTES-LOC-DEPT-1). Mirrors ScopedSollicitatiesTab's shape (a thin wrapper
 * around a shared list body, fed by its own scoped fetch) rather than the
 * customer-level CustomerNotesTab: the level is already fixed by which tab you
 * are on, so there is no "gekoppeld aan" picker here — every note composed on
 * this tab is pinned to THIS location/department id, one POST field, never a
 * choice. Reuses the shared components/drawer/tabs/NotesTab the exact same way
 * CustomerNotesTab does (§11 — one notes surface family, never a fork); no
 * timeline/conversations section here (this level has neither yet).
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import { useScopedCustomerNotes } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helper — accept any props at the boundary (mirrors CustomerNotesTab).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

export default function ScopedNotesTab({ scope, id, customerId }: {
  scope: 'location' | 'department'
  id: Id
  customerId?: Id
}) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const authorInitials = initialsOf(auth?.user?.name ?? '')
  // Location/department notes never switch note-type scope (only a customer_contact_id
  // link does, per CustomerController::addNote's own condition) — always 'customer' types.
  const { writableTypes: noteTypes, types: chipTypes } = useNoteTypes('customer')
  const { notes, loading, error, reload } = useScopedCustomerNotes(customerId, scope, id)

  // Pinned to THIS level — writes through the SAME endpoint the customer-level
  // composer uses (CustomerController::addNote), just with the level field fixed.
  // NOTE-TAAL-1: `language` rides along optionally, same as the customer-level composer.
  const addNote = (payload: { type: string; title: string; body: string; language?: string }) => {
    if (!customerId) return
    api.post(`/customers/${customerId}/notes`, {
      type: payload.type, title: payload.title, text: payload.body, language: payload.language,
      ...(scope === 'location' ? { customer_location_id: id } : { customer_department_id: id }),
    }).then(reload)
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // Four explicit UI states (§3) — never a blank screen while the scoped fetch is in flight or failed.
  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div>
  if (error) return <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('scopedList.loadError')}</div>

  return (
    <NotesTab
      notes={notes} onAddNote={addNote} noteTypes={noteTypes} chipTypes={chipTypes}
      authorInitials={authorInitials}
      showTimeline={false} showConversations={false}
      labels={{
        notes: t('notes.notes'), newNote: t('notes.newNote'), type: t('notes.type'),
        save: t('notes.save'), cancel: t('notes.cancel'), edit: t('notes.edit'),
        notesEmpty: t('notes.notesEmpty'),
        notePlaceholder: () => t('notes.notePlaceholder'),
        searchPlaceholder: t('notes.searchPlaceholder'),
      }}
    />
  )
}
