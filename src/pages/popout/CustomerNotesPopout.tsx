/**
 * CustomerNotesPopout — F5-uitbreiding: the customer variant of the standalone,
 * id-driven second-screen notes window. Mirrors CustomerNotesTab's 'notes'
 * sub-tab (components/drawer/tabs/NotesTab, same composer/note-card look) but
 * drops the sub-tab bar (Taken/Tijdlijn/Vacature-zichtbaarheid) and the
 * location/department/contact "linked aan" composer picker — same notes-only
 * simplification the candidate popout already makes for timeline/conversations/
 * tasks/consent. READING still shows a note's existing link (soft "linked to X"
 * chip, read-parity with the drawer); only the ADD flow is simplified.
 */
import { useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import PopoutShell from './PopoutShell'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useAuth } from '@/context/AuthContext'
import { initialsOf } from '@/lib/initials'
import { useCustomerLite } from './hooks/useCustomerLite'
import { usePopoutCustomerNotes } from './hooks/usePopoutCustomerNotes'
import type { CustomerNote } from '@/types/customer'

type AnyProps = Record<string, unknown>
// Still-untyped JS component — accept any props at the boundary (mirrors CustomerNotesTab).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// Soft-tint "linked to {name}" chip (§4 convention) — mirrors CustomerNotesTab's
// own linkChip exactly, so a location/department/contact-linked note reads the
// same in the popout as it does in the drawer.
function linkChip(label: string) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
      padding: '1px 6px', borderRadius: 99, marginRight: 6,
      background: 'color-mix(in srgb, var(--color-info) 12%, transparent)', color: 'var(--color-info)',
      border: '1px solid color-mix(in srgb, var(--color-info) 40%, transparent)' }}>
      {label}
    </span>
  )
}

export default function CustomerNotesPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('customers')
  const { customer, loading, error, reload } = useCustomerLite(id)
  const { notes, addNote } = usePopoutCustomerNotes(id)
  // Fallback avatar for a freshly-added note before the server's real author comes
  // back — the SIGNED-IN user's initials, exactly like CustomerDrawer's own
  // `authorInitials` (never the customer's own initials — that would misattribute
  // authorship of the note to the company itself).
  const auth = useAuth()
  const authorInitials = initialsOf(auth?.user?.name ?? '')
  // Note categories: customer-level types are the only writable scope here (the
  // location/department/contact link picker is dropped — see the file docblock);
  // both scopes are still merged for CHIP resolution so an existing contact-scoped
  // note's type still resolves its real label/colour when read.
  const { writableTypes: customerNoteTypes, types: customerChipTypes } = useNoteTypes('customer')
  const { types: contactChipTypes } = useNoteTypes('contact')
  const chipTypes = [...customerChipTypes, ...contactChipTypes]
    .filter((nt, i, arr) => arr.findIndex(x => x.value === nt.value) === i)

  // Window title — restored on unmount so a reused/closed OS window slot never
  // keeps a stale title (mirrors CandidateNotesPopout).
  useEffect(() => {
    if (!customer) return
    const previous = document.title
    document.title = t('popout.windowTitle', { name: customer.name })
    return () => { document.title = previous }
  }, [customer, t])

  // Read-parity chip decoration — department wins over location (the deepest
  // level, mirrors the backend's own CustomerNote::levelContext() priority),
  // then the independent contact link; every other note is untouched.
  const notesWithChip: Array<Omit<CustomerNote, 'title'> & { title: ReactNode }> = notes.map(n => {
    const linkedName = n.departmentName || n.locationName || n.contactName
    return linkedName ? { ...n, title: linkChip(t('notes.linkedTo', { name: linkedName })) } : n
  })

  const notesProps = {
    notes: notesWithChip, onAddNote: addNote, noteTypes: customerNoteTypes, chipTypes,
    authorInitials,
    labels: {
      notes: '', newNote: t('notes.newNote'), type: t('notes.type'),
      save: t('notes.save'), cancel: t('notes.cancel'), edit: t('notes.edit'),
      notesEmpty: t('notes.notesEmpty'),
      notePlaceholder: () => t('notes.notePlaceholder'),
      searchPlaceholder: t('notes.searchPlaceholder'),
    },
  }

  return (
    <PopoutShell
      loading={loading} error={error || !customer} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={customer?.name ?? ''} initials={customer?.initials ?? ''} subtitle={t('notes.notes')}
    >
      <NotesTab {...notesProps} showTimeline={false} showConversations={false} />
    </PopoutShell>
  )
}
