/**
 * NotesPopoutPage — NOTITIE-POPOUT-1 F5 (Trap B): the standalone, id-driven
 * second-screen window for a candidate's notes. Lives OUTSIDE DashboardLayout
 * (no sidebar/topbar/Koios panel — see the route in App.tsx) so this whole
 * browser window can sit on a second monitor next to whatever else a recruiter
 * is working on; the shared httpOnly-cookie session, theme and language all
 * bootstrap the same way they do for the main window (same origin). Renders the
 * SAME shared NotesTab every entity's Communication tab uses (mirrors
 * CommunicationTab's 'notes' sub-tab), scoped to notes only — no timeline/
 * conversations in this window.
 */
import { useEffect } from 'react'
import type { ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes, SYSTEM_NOTE_TYPES } from '@/lib/useNoteTypes'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useCandidateNotes } from '@/pages/candidates/hooks/useCandidateNotes'
import { useCandidateLite } from './hooks/useCandidateLite'

type AnyProps = Record<string, unknown>
// Still-untyped JS component — accept any props at the boundary (mirrors CommunicationTab).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// Header + notes-area placeholder while the candidate identity loads — never a
// blank window (§3: always handle loading explicitly).
function PopoutSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div aria-busy="true" aria-live="polite" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="sr-only">{loadingLabel}</span>
      <div className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--hover-bg)' }} />
        <div style={{ height: 14, width: 160, borderRadius: 4, background: 'var(--hover-bg)' }} />
      </div>
      <div className="animate-pulse" style={{ height: 34, borderRadius: 8, background: 'var(--hover-bg)' }} />
      <div className="animate-pulse" style={{ height: 64, borderRadius: 8, background: 'var(--hover-bg)' }} />
      <div className="animate-pulse" style={{ height: 64, borderRadius: 8, background: 'var(--hover-bg)' }} />
    </div>
  )
}

export default function NotesPopoutPage() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const { t } = useTranslation('candidates')
  const { candidate, loading, error, reload } = useCandidateLite(candidateId)
  // Note categories + contact channels — the same tenant lookups the drawer's
  // Communication tab reads (NOTE-TYPES-2/3 / last-contact-types).
  const { types: allNoteTypes, writableTypes } = useNoteTypes('candidate')
  const { types: channels } = useLastContactTypes()
  // Notes persist via the API — same hook, same host as CommunicationTab.
  const { notes, addNote, editNote, deleteNote } = useCandidateNotes(candidateId)
  // System notes (status/phase changes) never belong in the notes thread — filtered
  // out exactly like CommunicationTab, so edit/delete indexes stay aligned.
  const isSystem = (n: { type?: string; is_system?: unknown }) => Boolean(n.is_system) || SYSTEM_NOTE_TYPES.has(String(n.type ?? ''))
  const indexed = notes.map((n, i) => ({ ...n, __idx: i }))
  const userNotes = indexed.filter(n => !isSystem(n))
  const editUserNote = (fi: number, payload: { type: string; title: string; body: string; channel?: string }) =>
    editNote(userNotes[fi].__idx, payload)
  const deleteUserNote = (fi: number) => deleteNote(userNotes[fi].__idx)

  // Window title — "Notes — <candidate name>" while this popout is open; restored
  // on unmount so a reused/closed OS window slot never keeps a stale title.
  useEffect(() => {
    if (!candidate) return
    const previous = document.title
    document.title = t('popout.windowTitle', { name: candidate.name })
    return () => { document.title = previous }
  }, [candidate, t])

  // Loading — skeleton, never a blank flash before the error/success state.
  if (loading) return <PopoutSkeleton loadingLabel={t('common:loading')} />

  // Error — the candidate identity failed to load (bad/stale id, network). Notes
  // themselves degrade quietly (useCandidateNotes shows an empty thread on a
  // failed GET); this state specifically means "we don't even know whose notes
  // these are", so it blocks the surface instead of showing an anonymous thread.
  if (error || !candidate) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 10, padding: 24, textAlign: 'center' }}>
        <AlertTriangle size={22} style={{ color: 'var(--color-danger)' }} aria-hidden="true" />
        <p style={{ fontSize: 13, color: 'var(--text)' }}>{t('popout.loadError')}</p>
        <button onClick={() => reload()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
          padding: '5px 12px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
          {t('common:error.retry')}
        </button>
      </div>
    )
  }

  // Success — shared NotesTab props, mirroring CommunicationTab's 'notes' sub-tab
  // (empty state is handled BY NotesTab itself via labels.notesEmpty).
  const notesProps = {
    notes: userNotes, onAddNote: addNote, onEditNote: editUserNote, onDeleteNote: deleteUserNote,
    noteTypes: writableTypes, chipTypes: allNoteTypes, channels, authorInitials: candidate.initials,
    labels: {
      notes: '', newNote: t('communication.newNote'),
      deleteNote: t('communication.deleteNote'), deleteConfirm: t('communication.deleteConfirm'),
      type: t('communication.type'), channel: t('communication.channel'), channelNone: t('communication.channelNone'),
      save: t('common:save'), cancel: t('common:cancel'),
      notesEmpty: t('sections.notesEmpty'),
      notePlaceholder: (typeLabel: string) => t('communication.notePlaceholder', { type: typeLabel }),
      searchPlaceholder: t('communication.searchPlaceholder'),
    },
  }

  // Full-viewport shell: a calm header (avatar + name) above the shared notes
  // surface — same visual language as the drawer's own Communication tab.
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
        borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <Avatar initials={candidate.initials} soft size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {candidate.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('sections.notes')}</div>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>
        <NotesTab {...notesProps} showTimeline={false} showConversations={false} />
      </div>
    </div>
  )
}
