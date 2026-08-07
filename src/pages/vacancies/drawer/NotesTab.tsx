import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import type { VacancyDetail } from '@/types/vacancy'

// Structural match for the shared NotesTab's NoteItem (typed fields + open index).
interface Note { type?: string; title?: string; author?: string; text?: string; body?: string; created_at?: string; time?: string; [k: string]: unknown }

/**
 * NotesTab — internal notes on a vacancy. VACANCY-NOTE-TYPE-1 (2026-08-04): rewritten
 * onto the SAME shared NotesTab family applications/opportunities use (mirrors
 * pages/applications/drawer/NotesTab.tsx), now that VacancyNoteController validates
 * `type` against the entity-scoped note_types lookup — the previous bespoke composer
 * had no type picker at all ("note TYPES stay as-is until NOTE-TYPES-3 lands", which
 * has now landed).
 */
export default function NotesTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  // Note categories from the tenant lookup, scoped to 'vacancy' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('vacancy')
  const [notes, setNotes] = useState<Note[]>((v.notes ?? []) as Note[])

  // Author avatar initials — the vacancy's owning recruiter, else a Koios fallback.
  const initials = (v.owner?.name ?? 'Koios').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Optimistic add, then persist. OPTIMISTIC-REVERT-1 pattern (mirrors applications):
  // on failure the exact optimistic object is removed again and the server's own
  // message surfaced — never a silently-stuck fake note. NOTE-TAAL-1: `payload` is
  // forwarded to the API AS-IS, so the optional `language` field rides along for free.
  const addNote = (payload: { type: string; title: string; body: string; language?: string }) => {
    const local: Note = { ...payload, text: payload.body, author: v.owner?.name ?? 'Koios', created_at: new Date().toISOString() }
    setNotes(prev => [local, ...prev])
    if (v.id != null) {
      api.post(`/vacancies/${v.id}/notes`, payload).catch(err => {
        setNotes(prev => prev.filter(n => n !== local))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }

  return (
    <SharedNotesTab
      notes={notes}
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
      }}
    />
  )
}
