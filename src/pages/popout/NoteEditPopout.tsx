/**
 * NoteEditPopout — ONE existing note in a second-screen window of its own
 * (NOTITIE-POPOUT-URL-1, Danny 11-08: "zet het notitie-id in de URL" — put the
 * note id in the URL — + live 13-08: "zoals de pop-out van de profieltekst werkt
 * moeten ook de notities werken" — notes must work the same way the profile-text
 * pop-out works).
 * Route: /popout/notes/:entity/:id/:noteId — the id in the URL is the whole
 * design: no BroadcastChannel handoff to resolve, no race against a thread
 * window's own loading, and re-opening the same note re-focuses its OS window.
 *
 * A-popout-1 (14-08): generalised beyond candidate-only — `entity` now
 * dispatches to a per-entity loader component (candidate/application), each
 * wiring its own lite-identity + notes hook, but sharing ONE `NoteEditor` body
 * (§11: one form, no second copy). Any entity outside NOTE_EDIT_POPOUT_ENTITIES
 * (customer/vacancy today — see that set's own docblock in lib/secondScreen for
 * exactly why) renders the honest error row here, never a form whose save the
 * server would 403 or, worse, a window that cannot even resolve the id (§3, no
 * fake affordance for a route that does not really PATCH the note).
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
import { useCandidateNotes, type CandidateNote } from '@/pages/candidates/shared'
import { useCandidateLite } from './hooks/useCandidateLite'
import { useApplicationLite } from './hooks/useApplicationLite'
import { usePopoutApplicationNotes, type PopoutApplicationNote } from './hooks/usePopoutApplicationNotes'
import type { NoteType, NotesLabels } from '@/components/drawer/tabs/NotesTab'

// Structural shape NoteEditor needs off a note — both CandidateNote and
// PopoutApplicationNote already satisfy it, so ONE editor body serves both
// entities without a per-entity copy (§11).
interface EditableNote {
  id?: string | number
  type?: string
  channel?: string
  title?: string
  body?: string
  text?: string
  language?: string
  author_id?: string | number | null
  [k: string]: unknown
}

export default function NoteEditPopout() {
  const { entity } = useParams()
  const { t } = useTranslation('common')

  if (entity === 'candidate') return <CandidateNoteEditPopout />
  if (entity === 'application') return <ApplicationNoteEditPopout />
  // Any other entity has no route that can really PATCH a note yet (see
  // NOTE_EDIT_POPOUT_ENTITIES's own docblock for the current state per entity) —
  // an honest error row, never a form (§3).
  return (
    <PopoutShell loading={false} error loadingLabel={t('loading')} errorLabel={t('popout.loadError')} retryLabel={t('error.retry')}
      onRetry={() => {}} name="" initials="" subtitle="">
      {null}
    </PopoutShell>
  )
}

// --- Candidate branch (original NOTITIE-POPOUT-URL-1 implementation) ---------
function CandidateNoteEditPopout() {
  const { id, noteId } = useParams()
  const { t } = useTranslation('candidates')
  const { candidate, loading, error, reload } = useCandidateLite(id)
  const { notes, loaded, editNote } = useCandidateNotes(id)
  const { writableTypes } = useNoteTypes('candidate')
  const { types: channels } = useLastContactTypes()

  const noteIndex = notes.findIndex(n => String(n.id) === String(noteId))
  const note = noteIndex >= 0 ? (notes[noteIndex] as CandidateNote) : null

  useEffect(() => {
    if (!candidate) return
    const previous = document.title
    document.title = t('popout.windowTitle', { name: candidate.name })
    return () => { document.title = previous }
  }, [candidate, t])

  const notFound = loaded && (!note || isSystemNote(note))

  return (
    <PopoutShell
      loading={loading || (!loaded && !error)}
      error={Boolean(error) || !candidate || notFound}
      onRetry={reload}
      loadingLabel={t('common:loading')}
      errorLabel={notFound ? t('popout.noteNotFound') : t('popout.loadError')}
      retryLabel={t('common:error.retry')}
      name={candidate?.name ?? ''} initials={candidate?.initials ?? ''} subtitle={t('sections.notes')}
    >
      {note && (
        <NoteEditor key={String(noteId)} note={note} managePermission="candidates.notes.manage_all"
          onSave={payload => editNote(noteIndex, payload)}
          noteTypes={writableTypes} channels={channels} labelsNs="candidates" />
      )}
    </PopoutShell>
  )
}

// --- Application branch (A-popout-1) -----------------------------------------
function ApplicationNoteEditPopout() {
  const { id, noteId } = useParams()
  const { t } = useTranslation('applications')
  const { application, loading, error, reload } = useApplicationLite(id)
  const { notes, editNote } = usePopoutApplicationNotes(id)
  const { writableTypes } = useNoteTypes('application')
  // No standalone GET for application notes (see usePopoutApplicationNotes'
  // own docblock) — "loaded" is simply "the lite fetch settled", the same
  // signal that also gates the note list itself (both ride the same request).
  const loaded = !loading && !error

  const noteIndex = notes.findIndex(n => String(n.id) === String(noteId))
  const note = noteIndex >= 0 ? (notes[noteIndex] as PopoutApplicationNote) : null

  useEffect(() => {
    if (!application) return
    const previous = document.title
    document.title = t('common:popout.windowTitle', { name: application.candidateName })
    return () => { document.title = previous }
  }, [application, t])

  const notFound = loaded && (!note || isSystemNote(note))

  return (
    <PopoutShell
      loading={loading}
      error={Boolean(error) || !application || notFound}
      onRetry={reload}
      loadingLabel={t('common:loading')}
      errorLabel={notFound ? t('common:popout.noteNotFound') : t('common:popout.loadError')}
      retryLabel={t('common:error.retry')}
      name={application?.candidateName ?? ''} initials={application?.initials ?? ''}
      subtitle={application?.vacancyTitle || t('notes.title')}
    >
      {note && (
        <NoteEditor key={String(noteId)} note={note} managePermission="applications.notes.manage_all"
          onSave={payload => editNote(noteIndex, payload)}
          noteTypes={writableTypes} channels={[]} labelsNs="applications" />
      )}
    </PopoutShell>
  )
}

// Inner editor — mounted only once the note exists (useNoteFields seeds ONCE at
// mount; the key above remounts it per note id, same recipe as the composer).
// Shared by BOTH entity branches (§11: one form, structural EditableNote input).
function NoteEditor({ note, onSave, noteTypes, channels, managePermission, labelsNs }: {
  note: EditableNote
  onSave: (payload: { type: string; title: string; body: string; channel?: string; language?: string }) => Promise<boolean>
  noteTypes: NoteType[]
  channels: NoteType[]
  managePermission: string
  labelsNs: 'candidates' | 'applications'
}) {
  const { t } = useTranslation(labelsNs)
  const auth = useAuth()
  const fields = useNoteFields({
    type: typeof note.type === 'string' ? note.type : undefined,
    channel: typeof note.channel === 'string' ? note.channel : undefined,
    title: typeof note.title === 'string' ? note.title : undefined,
    body: typeof note.body === 'string' ? note.body : (typeof note.text === 'string' ? note.text : undefined),
    language: typeof note.language === 'string' ? note.language : undefined,
  }, noteTypes)

  // Same edit right the list applies (noteRights) — a pasted URL is not a licence.
  const editable = canManageNote(note, auth?.user?.id, auth?.hasPermission ?? (() => false), managePermission)

  // The labels NoteFields reads. Candidates own dedicated communication.* keys;
  // applications.json (sister-agent namespace, reuse-only) has no equivalent, so
  // that branch reuses the generic common:edit-adjacent notes.* keys it already
  // ships (mirrors ApplicationNotesPopout.tsx's own key reuse).
  const labels: NotesLabels = labelsNs === 'candidates'
    ? { type: t('communication.type'), channel: t('communication.channel'),
        notePlaceholder: (typeLabel: string) => t('communication.notePlaceholder', { type: typeLabel }) }
    : { type: t('notes.type'), notePlaceholder: () => t('notes.placeholder') }
  // "Read-only" / "not found" copy: candidates.json owns its own popout.* pair
  // (pre-existing); applications.json has no equivalent (sister-agent namespace,
  // reuse-only), so that branch reuses the entity-agnostic common:popout.* pair
  // added alongside this generalisation (mirrors the existing windowTitle/loadError keys).
  const readOnlyCopy = labelsNs === 'candidates' ? t('popout.noteReadOnly') : t('common:popout.noteReadOnly')

  // Read-only: someone else's note without the manage right — show, never edit (§7).
  if (!editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div role="note" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12,
          background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {readOnlyCopy}
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
