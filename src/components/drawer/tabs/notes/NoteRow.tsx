/**
 * NoteRow — one regular note's rendering inside the notes list: avatar, type/
 * channel chips, title/author, "by whom · when (+ edited by)" meta, and the
 * per-note icon cluster (edit pencil, delete bin, second-screen pop-out,
 * restore-previous-version). Pulled out of NotesTab.tsx (§3 hard cap — the
 * file crossed its 400-line split trigger) — pure presentational, all rights
 * gating and callbacks arrive as props from the container.
 */
import type { TFunction } from 'i18next'
import { Edit2, ExternalLink, RotateCcw, Trash2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import SafeHtml from '@/components/ui/SafeHtml'
import { Caption } from '@/components/ui/typography'
import { initialsOf } from '@/lib/initials'
import { NoteTypeChip, NoteChannelChip } from './NoteChips'
import type { NoteItem, NoteType, NotesLabels, NotePayload } from '../NotesTab'

interface NoteRowProps {
  n: NoteItem
  i: number
  who: string
  authorInitials?: string
  chipTypes?: NoteType[]
  noteTypes: NoteType[]
  channels: NoteType[]
  labels: NotesLabels
  t: TFunction
  noteWhen: (n: NoteItem) => string | undefined
  noteEditor: (n: NoteItem) => string
  noteEdited: (n: NoteItem) => boolean
  canManageNote: (n: NoteItem) => boolean
  onEditNote?: (i: number, payload: NotePayload) => void
  onDeleteNote?: (i: number) => void
  openEdit: (i: number) => void
  requestDelete: (i: number) => void
  // Second-screen (NOTITIE-POPOUT-EDIT-1 → URL-1) — only where the receiving
  // window can really PATCH the note (see canPopOutNote on the container).
  canPopOutNote: boolean
  openNoteWindow: (noteId: string) => void
  noteIdOf: (n: NoteItem) => string | null
  // Undo (NOTE-UNDO-FE-1, K-172) — only where the host wired both routes.
  onFetchPreviousVersion?: (i: number) => Promise<unknown>
  onRestorePreviousNote?: (i: number) => Promise<boolean>
  restoringIdx: number | null
  requestRestorePrevious: (i: number) => void
}

// One note-thread row — avatar, chips, meta line and the per-note action icons.
export default function NoteRow({
  n, i, who, authorInitials, chipTypes, noteTypes, channels, labels, t,
  noteWhen, noteEditor, noteEdited, canManageNote, onEditNote, onDeleteNote, openEdit, requestDelete,
  canPopOutNote, openNoteWindow, noteIdOf, onFetchPreviousVersion, onRestorePreviousNote, restoringIdx, requestRestorePrevious,
}: NoteRowProps) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <Avatar initials={who ? initialsOf(who) : authorInitials} size={26} />
      <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            {n.type && <NoteTypeChip value={n.type} types={chipTypes ?? noteTypes} />}
            {n.channel && <NoteChannelChip value={n.channel} channels={channels} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.title ?? who}</span>
          </div>
          {/* "By whom · when" (always) + "edited by X" once the backend logs it (NOTES-2b). */}
          <Caption as="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            {who ? `${who} · ` : ''}{noteWhen(n)}
            {/* EDIT-MARKER-1 (Danny 08-08 "2 keer een potloodje"): plain italic
                meta text, no icon — a pencil here read as a second edit BUTTON. */}
            {noteEdited(n) && (
              <span style={{ fontStyle: 'italic' }}>
                · {t('notes.editedBy', { name: noteEditor(n), defaultValue: 'bewerkt door {{name}}' })}
              </span>
            )}
          </Caption>
          {/* RECHTEN-DETAIL-1: own note or manage_all — never a button the BE will 403. */}
          {onEditNote && canManageNote(n) && (
            <button onClick={() => openEdit(i)} title={labels.edit} aria-label={labels.edit}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact inline icon cluster in the note row (13px icons, 6px step): Button's 28px box would widen every row; identity stays muted ink on none
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px', display: 'flex' }}>
              <Edit2 size={13} />
            </button>
          )}
          {onDeleteNote && canManageNote(n) && (
            <button onClick={() => requestDelete(i)} title={labels.deleteNote} aria-label={labels.deleteNote}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact inline icon cluster in the note row (13px icons, 6px step): Button's 28px box would widen every row; identity stays muted ink on none
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px', display: 'flex' }}>
              <Trash2 size={13} />
            </button>
          )}
          {/* NOTITIE-POPOUT-EDIT-1 → URL-1: third icon of the same group —
              same borderless, muted, 6px-left footprint as the pencil and
              the bin. Opens THIS note's own second-screen window by URL
              (the profile-text treatment): the id is in the address, so
              there is no handoff to race and re-opening re-focuses the
              same OS window. Same edit rights as the pencil, only where
              that window can really save, never inside that window. */}
          {canPopOutNote && canManageNote(n) && noteIdOf(n) && (
            <button type="button" onClick={() => openNoteWindow(noteIdOf(n) as string)}
              title={t('openSecondScreen')} aria-label={t('openSecondScreen')}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact inline icon cluster in the note row (13px icons, 6px step): Button's 28px box would widen every row; identity stays muted ink on none
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '0 0 0 6px', display: 'flex' }}>
              <ExternalLink size={13} />
            </button>
          )}
          {/* NOTE-UNDO-FE-1 (K-172): fourth icon of the same borderless
              muted group — only where the host wired the family's
              undo routes AND this exact note carries a filled slot. */}
          {onFetchPreviousVersion && onRestorePreviousNote && n.has_previous_version && canManageNote(n) && (
            // Shared Button (ghost, iconOnly) — new debt never re-uses the
            // sibling icons' pre-existing raw-button exception (HUISSTIJL-1
            // ceiling: a fresh eslint-disable here would raise the file's
            // frozen count, which the gate refuses without --force).
            <Button variant="ghost" iconOnly size="sm" onClick={() => requestRestorePrevious(i)} disabled={restoringIdx === i}
              title={labels.restorePrevious} aria-label={labels.restorePrevious ?? ''}
              style={{ marginLeft: 6, flexShrink: 0 }}>
              <RotateCcw size={13} />
            </Button>
          )}
        </div>
        <SafeHtml style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} html={n.text ?? n.body ?? ''} />
      </div>
    </div>
  )
}
