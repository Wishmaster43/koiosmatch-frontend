/**
 * CandidateNotesPopout — NOTITIE-POPOUT-1 F5 (Trap B): the candidate variant of
 * the standalone, id-driven second-screen notes window. Renders the SAME shared
 * NotesTab every entity's Communication tab uses (mirrors CommunicationTab's
 * 'notes' sub-tab), scoped to notes only — no timeline/conversations in this
 * window. Extracted out of NotesPopoutPage (F5-uitbreiding) so the dispatcher
 * only picks an entity; each entity's own wiring lives in its own thin page.
 */
import { useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import PopoutShell from './PopoutShell'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { candidateNoteLabels, useCandidateNotes, useUserNotesThread } from '@/pages/candidates/shared'
import { useCandidateLite } from './hooks/useCandidateLite'

type AnyProps = Record<string, unknown>
// Still-untyped JS component — accept any props at the boundary (mirrors CommunicationTab).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// Second-screen notes window for one candidate (see the module doc above): renders the same shared NotesTab the drawer's Communication tab uses, notes only.
export default function CandidateNotesPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('candidates')
  const { candidate, loading, error, reload } = useCandidateLite(id)
  // Note categories + contact channels — the same tenant lookups the drawer's
  // Communication tab reads (NOTE-TYPES-2/3 / last-contact-types).
  const { types: allNoteTypes, writableTypes } = useNoteTypes('candidate')
  const { types: channels } = useLastContactTypes()
  // Notes persist via the API — same hook, same host as CommunicationTab.
  const { notes, addNote, editNote, deleteNote } = useCandidateNotes(id)
  // NOTES-THREAD-1: user vs. system notes + the filtered-index remap, shared with
  // CommunicationTab's own Notities sub-tab (see useUserNotesThread's own doc).
  const { userNotes, editUserNote, deleteUserNote } = useUserNotesThread(notes, { editNote, deleteNote })

  // Window title — "Notes — <candidate name>" while this popout is open; restored
  // on unmount so a reused/closed OS window slot never keeps a stale title.
  useEffect(() => {
    if (!candidate) return
    const previous = document.title
    document.title = t('popout.windowTitle', { name: candidate.name })
    return () => { document.title = previous }
  }, [candidate, t])

  // Success — shared NotesTab props, mirroring CommunicationTab's 'notes' sub-tab
  // (empty state is handled BY NotesTab itself via labels.notesEmpty).
  const notesProps = {
    notes: userNotes, onAddNote: addNote, onEditNote: editUserNote, onDeleteNote: deleteUserNote,
    noteTypes: writableTypes, chipTypes: allNoteTypes, channels, authorInitials: candidate?.initials,
    labels: candidateNoteLabels(t),
  }

  return (
    <PopoutShell
      loading={loading} error={error || !candidate} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={candidate?.name ?? ''} initials={candidate?.initials ?? ''} subtitle={t('sections.notes')}
    >
      {/* NOTITIE-POPOUT-HANDOFF-1: `role: 'window'` makes this the RECEIVING side —
          a note the recruiter was half-typing in the drill-down opens here, in the
          composer, instead of being lost. It renders no pop-out button of its own. */}
      <NotesTab {...notesProps} showTimeline={false} showConversations={false}
        popout={id ? { entity: 'candidate', id, role: 'window' } : undefined} />
    </PopoutShell>
  )
}
