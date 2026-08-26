/**
 * ApplicationNotesPopout — A-popout-1: the application variant of the standalone,
 * id-driven second-screen notes window. Mirrors applications/drawer/NotesTab.tsx
 * (same shared NotesTab, same note-type lookup) — notes only, no other
 * application tab in this window (mirrors the candidate/customer/vacancy popouts).
 * PATCH /applications/{id}/notes/{note} now exists (A-popout-1) so this window
 * can really edit an existing note — no DELETE route yet, so no delete button.
 */
import { useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import PopoutShell from './PopoutShell'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useApplicationLite } from './hooks/useApplicationLite'
import { usePopoutApplicationNotes } from './hooks/usePopoutApplicationNotes'

type AnyProps = Record<string, unknown>
// Still-untyped JS component — accept any props at the boundary (mirrors applications/drawer/NotesTab.tsx).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// The standalone second-screen notes window for one application: notes only,
// same shared NotesTab/note-type lookup the drill-down's own tab uses.
export default function ApplicationNotesPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('applications')
  const { application, loading, error, reload } = useApplicationLite(id)
  const { notes, addNote, editNote } = usePopoutApplicationNotes(id)
  // Note categories from the tenant lookup, scoped to 'application' (NOTE-TYPES-2/3),
  // mirrors applications/drawer/NotesTab.tsx.
  const { writableTypes: noteTypes } = useNoteTypes('application')
  const initials = application?.initials ?? ''

  // Window title — restored on unmount so a reused/closed OS window slot never
  // keeps a stale title (mirrors the other entity popouts). applications.json has
  // no dedicated popout.windowTitle key (out of this lane's locale ownership,
  // see the popout-labels note below) so this reuses the generic common:popout key.
  useEffect(() => {
    if (!application) return
    const previous = document.title
    document.title = t('common:popout.windowTitle', { name: application.candidateName })
    return () => { document.title = previous }
  }, [application, t])

  const notesProps = {
    notes, onAddNote: addNote, onEditNote: editNote, noteTypes, authorInitials: initials,
    // POPOUT-LABELS-1: applications.json (lane-A owned) has notes.title/new/type/
    // save/cancel/empty/searchPlaceholder already — reused as-is, same keys the
    // drawer's own NotesTab.tsx uses. It has no "edit" key, so this borrows the
    // generic common:edit (see the file-level comment) — no applications.json
    // edit was made for this task.
    labels: {
      notes: t('notes.title'), newNote: t('notes.new'), type: t('notes.type'),
      save: t('notes.save'), cancel: t('notes.cancel'), edit: t('common:edit'),
      notesEmpty: t('notes.empty'),
      notePlaceholder: () => t('notes.placeholder'),
      searchPlaceholder: t('notes.searchPlaceholder'),
    },
  }

  return (
    <PopoutShell
      loading={loading} error={error || !application} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('common:popout.loadError')} retryLabel={t('common:error.retry')}
      name={application?.candidateName ?? ''} initials={initials} subtitle={application?.vacancyTitle || t('notes.title')}
    >
      {/* NOTITIE-POPOUT-HANDOFF-1: `role: 'window'` makes this the RECEIVING side —
          a note the recruiter was half-typing in the drill-down opens here, in the
          composer, instead of being lost. It renders no pop-out button of its own. */}
      <NotesTab {...notesProps} showTimeline={false} showConversations={false}
        popout={id ? { entity: 'application', id, role: 'window' } : undefined} />
    </PopoutShell>
  )
}
