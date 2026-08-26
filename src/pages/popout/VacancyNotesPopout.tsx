/**
 * VacancyNotesPopout — F5-uitbreiding: the vacancy variant of the standalone,
 * id-driven second-screen notes window. Mirrors vacancies/drawer/NotesTab.tsx
 * (same shared NotesTab, same note-type lookup, same optimistic add) — notes
 * only, no other vacancy tab in this window (mirrors the candidate/customer popouts).
 */
import { useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import PopoutShell from './PopoutShell'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useAuth } from '@/context/AuthContext'
import { useVacancyLite } from './hooks/useVacancyLite'
import { usePopoutVacancyNotes } from './hooks/usePopoutVacancyNotes'

type AnyProps = Record<string, unknown>
// Still-untyped JS component — accept any props at the boundary (mirrors vacancies/drawer/NotesTab.tsx).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// Second-screen notes window for one vacancy (see the module doc above): mirrors the drawer's own NotesTab, notes only.
export default function VacancyNotesPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('vacancies')
  const { vacancy, loading, error, reload } = useVacancyLite(id)
  // Author fallback for a fresh optimistic note — the vacancy's OWNER isn't part
  // of the lite fetch (see useVacancyLite's docblock), so this uses the signed-in
  // user's own name (the actual author the backend stamps), falling back to the
  // same 'Koios' default the drawer's NotesTab.tsx uses.
  const auth = useAuth()
  const authorName = auth?.user?.name ?? 'Koios'
  const { notes, addNote } = usePopoutVacancyNotes(id, authorName)
  // Note categories from the tenant lookup, scoped to 'vacancy' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('vacancy')
  const initials = authorName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Window title — restored on unmount so a reused/closed OS window slot never
  // keeps a stale title (mirrors CandidateNotesPopout).
  useEffect(() => {
    if (!vacancy) return
    const previous = document.title
    document.title = t('popout.windowTitle', { name: vacancy.name })
    return () => { document.title = previous }
  }, [vacancy, t])

  const notesProps = {
    notes, onAddNote: addNote, noteTypes, authorInitials: initials,
    labels: {
      notes: t('notes.title'), newNote: t('notes.new'), type: t('notes.type'),
      save: t('notes.save'), cancel: t('notes.cancel'),
      notesEmpty: t('notes.empty'),
      notePlaceholder: () => t('notes.placeholder'),
      searchPlaceholder: t('notes.searchPlaceholder'),
    },
  }

  return (
    <PopoutShell
      loading={loading} error={error || !vacancy} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={vacancy?.name ?? ''} initials={vacancy?.initials ?? ''} subtitle={t('notes.title')}
      // VAC-NOTES-CALM-1 (PDF-VACATURES point 28): no repeated vacancy name in
      // the notes header — the window title (set below) already names it, and
      // this surface should read like the candidate's calm profile-text block.
      hideEntityName
    >
      {/* NOTITIE-POPOUT-HANDOFF-1: `role: 'window'` makes this the RECEIVING side —
          a note the recruiter was half-typing in the drill-down opens here, in the
          composer, instead of being lost. It renders no pop-out button of its own. */}
      <NotesTab {...notesProps} showTimeline={false} showConversations={false}
        popout={id ? { entity: 'vacancy', id, role: 'window' } : undefined} />
    </PopoutShell>
  )
}
