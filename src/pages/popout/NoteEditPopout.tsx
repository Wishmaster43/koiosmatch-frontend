/**
 * NoteEditPopout — ONE existing note in a second-screen window of its own
 * (NOTITIE-POPOUT-URL-1, Danny 11-08 "zet het notitie-id in de URL" + live 13-08
 * "zoals de pop-out van de profieltekst werkt moeten ook de notities werken").
 * Route: /popout/notes/:entity/:id/:noteId — the id in the URL is the whole
 * design: no BroadcastChannel handoff to resolve, no race against a thread
 * window's own loading, and re-opening the same note re-focuses its OS window.
 *
 * Candidate-only today: NOTE_EDIT_POPOUT_ENTITIES says whose popout can really
 * PATCH a note — any other entity in the URL renders the honest error row, never
 * a form whose save would duplicate the note (§3).
 *
 * A pasteable URL means THIS page re-decides the edit right (noteRights, the
 * same rule the list uses): someone else's note renders read-only with a notice,
 * never a form whose save the server would 403 (§7: UI gate, BE re-checks).
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import PopoutShell from './PopoutShell'
import PopoutSaveFooter from './PopoutSaveFooter'
import NoteFields from '@/components/drawer/tabs/notes/NoteFields'
import { useNoteFields } from '@/components/drawer/tabs/notes/useNoteFields'
import { canManageNote, isSystemNote } from '@/components/drawer/tabs/notes/noteRights'
import SafeHtml from '@/components/ui/SafeHtml'
import { useAuth } from '@/context/AuthContext'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useCandidateNotes, type CandidateNote } from '@/pages/candidates/hooks/useCandidateNotes'
import { useCandidateLite } from './hooks/useCandidateLite'
import { NOTE_EDIT_POPOUT_ENTITIES } from '@/lib/secondScreen'
import type { PopoutEntity } from '@/lib/secondScreen'
import type { NoteType, NotesLabels } from '@/components/drawer/tabs/NotesTab'

export default function NoteEditPopout() {
  const { entity, id, noteId } = useParams()
  const { t } = useTranslation('candidates')
  const { candidate, loading, error, reload } = useCandidateLite(id)
  const { notes, loaded, editNote } = useCandidateNotes(id)
  const { writableTypes } = useNoteTypes('candidate')
  const { types: channels } = useLastContactTypes()

  // The note this window was pointed at — index-based because editNote takes the
  // list index (it resolves the id itself against the same list).
  const noteIndex = notes.findIndex(n => String(n.id) === String(noteId))
  const note = noteIndex >= 0 ? (notes[noteIndex] as CandidateNote) : null

  // Window title — "Notes — <candidate name>", restored on unmount (mirrors
  // CandidateNotesPopout so both note windows title themselves identically).
  useEffect(() => {
    if (!candidate) return
    const previous = document.title
    document.title = t('popout.windowTitle', { name: candidate.name })
    return () => { document.title = previous }
  }, [candidate, t])

  // Only entities whose popout can really PATCH a note own this route (§3).
  const entityOk = NOTE_EDIT_POPOUT_ENTITIES.has(entity as PopoutEntity)
  // "Note absent" is only a verdict once the thread really loaded; a system note
  // is never editable text (noteRights — same rule as the list).
  const notFound = loaded && (!note || isSystemNote(note))

  return (
    <PopoutShell
      loading={loading || (!loaded && !error)}
      error={Boolean(error) || !candidate || !entityOk || notFound}
      onRetry={reload}
      loadingLabel={t('common:loading')}
      errorLabel={notFound ? t('popout.noteNotFound') : t('popout.loadError')}
      retryLabel={t('common:error.retry')}
      name={candidate?.name ?? ''} initials={candidate?.initials ?? ''} subtitle={t('sections.notes')}
    >
      {note && (
        <NoteEditor key={String(noteId)} note={note}
          onSave={payload => editNote(noteIndex, payload)}
          noteTypes={writableTypes} channels={channels} />
      )}
    </PopoutShell>
  )
}

// Inner editor — mounted only once the note exists (useNoteFields seeds ONCE at
// mount; the key above remounts it per note id, same recipe as the composer).
function NoteEditor({ note, onSave, noteTypes, channels }: {
  note: CandidateNote
  onSave: (payload: { type: string; title: string; body: string; channel?: string; language?: string }) => Promise<boolean>
  noteTypes: NoteType[]
  channels: NoteType[]
}) {
  const { t } = useTranslation('candidates')
  const auth = useAuth()
  const fields = useNoteFields({
    type: typeof note.type === 'string' ? note.type : undefined,
    channel: typeof note.channel === 'string' ? note.channel : undefined,
    title: typeof note.title === 'string' ? note.title : undefined,
    body: typeof note.body === 'string' ? note.body : (typeof note.text === 'string' ? note.text : undefined),
    language: typeof note.language === 'string' ? note.language : undefined,
  }, noteTypes)

  // Same edit right the list applies (noteRights) — a pasted URL is not a licence.
  const editable = canManageNote(note, auth?.user?.id, auth?.hasPermission ?? (() => false), 'candidates.notes.manage_all')

  // The three labels NoteFields reads — same keys the drawer's tab passes.
  const labels: NotesLabels = {
    type: t('communication.type'), channel: t('communication.channel'),
    notePlaceholder: (typeLabel: string) => t('communication.notePlaceholder', { type: typeLabel }),
  }

  // Read-only: someone else's note without the manage right — show, never edit (§7).
  if (!editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div role="note" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12,
          background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {t('popout.noteReadOnly')}
        </div>
        <SafeHtml style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }} html={String(note.body ?? note.text ?? '')} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <NoteFields fields={fields} noteTypes={noteTypes} channels={channels} labels={labels}
        noteId={typeof note.id === 'string' ? note.id : undefined} editorMinHeight={220} />
      {/* The profile text's exact closing contract — shared footer (§11). */}
      <PopoutSaveFooter dirty={fields.dirty} onSave={() => onSave(fields.payload)} />
    </div>
  )
}
