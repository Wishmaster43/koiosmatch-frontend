/**
 * NoteComposer — the add/edit note POPUP (POPUP-SLEEP-1, Danny 06-08: "geen
 * popup, geen spellingchecker, geen vak voor de Koios AI verbeteringen" — this
 * file is the fix for all three). Was an inline block inside NotesTab.tsx;
 * moved onto the shared FloatingPanel (draggable/resizable/position-remembered,
 * mirrors MatchModal) so a recruiter can keep a note open NEXT TO the rest of
 * the drawer instead of it swallowing the tab's own scroll position.
 *
 * Mounted only while `open` (FloatingPanel's own rule — useFocusTrap needs a
 * fresh mount) — so ALL local state below initializes straight from
 * `initialNote` at mount time; no resync effect needed for a note swap, only
 * for the type list itself changing mid-compose (see the effect below, unchanged
 * from the previous inline composer).
 *
 * NOTE-TAAL-1: `language` is now part of the note payload (nullable — the
 * backend defaults to the tenant language when omitted). The RichTextEditor's
 * own language picker (TAAL-SPELL-1) is CONTROLLED here so the choice survives
 * into the save payload and prefills back on edit.
 *
 * RESIZE-GROWS-EDITOR (Danny 07-08, live popup feedback): `scrollBody={false}`
 * + a flex column + RichTextEditor's own `fill` prop — the SAME `scrollBody`
 * contract AddTaskModal/AddCandidateModal etc. already use for a pinned footer.
 * Without this the body wrapper scrolled as one fixed-height block, so dragging
 * the panel bigger just added empty space below a stuck editor; `fill` makes the
 * editor's own wrapper `flex:1`, so it is the one thing that grows/shrinks with
 * the panel — type/channel/title stay their natural height, the footer stays
 * pinned outside the scroll area, and the whole content area still scrolls
 * (never clips) if the panel is smaller than everything put together.
 *
 * NOTITIE-VOICE-1 (Danny 06-08 "dictatietaal = editortaal"): the dictation mic
 * rides the editor's own toolbar slot, next to the language picker, so one
 * `language` state drives spellcheck AND the recognition locale. Since
 * KOIOS-ASSIST-TEXTFIELDS (Danny 08-08 "alle omschrijvingen moeten ook een mic
 * functionaliteit hebben en Koios AI") that mic is no longer wired by hand
 * here: the shared `RichTextAssistBar` — the SAME component every other
 * description field now mounts — supplies it, including the escaped
 * append-to-last-paragraph behaviour this file used to own (§11: the helper
 * landed WITH adoption, no copy left behind). The bar runs in `modes={[]}`
 * (mic only) and the editor's own assist is switched off with `assist={false}`,
 * because this screen's Koios actions live in the richer `NoteAssistSection`
 * below the editor — it adds action-item extraction + the K0-B execute bridge,
 * which only make sense for a note.
 *
 * NOTITIE-POPOUT-HANDOFF-1 (Danny 09/10-08 "icon verplaatsen en werking hetzelfde
 * als icon profieltekst"): the pop-out icon LEFT the FloatingPanel's title bar and
 * now sits in this block's own title row, beside the note title and directly above
 * the editor — the exact place and the exact 26x26 bordered icon button the profile
 * text uses (candidates/drawer/ProfileTab). And, like the profile text, THE TEXT
 * TRAVELS: clicking it hands the whole half-typed note (type · channel · title ·
 * body · language) to the second screen over the shared popout channel
 * (hooks/useNotesPopout) instead of opening an empty sheet. This composer closes
 * only once that window confirms it holds the draft — never on the click itself.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Save, X } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import NoteFields from './NoteFields'
import { useNoteFields } from './useNoteFields'
import type { NoteDraft } from '@/hooks/useNotesPopout'
import type { NoteItem, NoteType, NotePayload, NotesLabels } from '../NotesTab'

interface NoteComposerProps {
  open: boolean
  // null = composing a NEW note; a NoteItem = editing that note in place.
  initialNote: NoteItem | null
  noteTypes: NoteType[]
  channels: NoteType[]
  labels: NotesLabels
  editorLabels?: Record<string, string>
  // Host-supplied composer row (customer tab's link picker) — NEW notes only,
  // mirrors the previous inline composer's `editingIdx === null` gate.
  composerExtra?: ReactNode
  // NOTITIE-POPOUT-HANDOFF-1: hand this half-typed note to the second screen.
  // Wired only by a host whose entity owns a `/popout/notes/{entity}/{id}` route
  // (candidate · customer · vacancy); the popout window itself never passes it (no
  // recursion). Handing over does NOT close this composer — the host closes it
  // once the window confirms it holds the draft.
  onPopOutDraft?: (draft: NoteDraft) => void
  // A handoff is in flight: the icon reads as busy and cannot be fired twice.
  popOutPending?: boolean
  // A draft handed over BY another window. Seeds exactly the fields `initialNote`
  // seeds, but the note stays a NEW one (a draft carries no note id).
  initialDraft?: NoteDraft | null
  onSave: (payload: NotePayload) => void
  onCancel: () => void
}

export default function NoteComposer({ open, initialNote, noteTypes, channels, labels, editorLabels, composerExtra, onPopOutDraft, popOutPending, initialDraft, onSave, onCancel }: NoteComposerProps) {
  const { t } = useTranslation('common')
  const isNew = initialNote == null
  // Existing note's own id (K0-B execute source) — a NoteItem's index signature
  // carries it at runtime even though the shared type doesn't declare it
  // (mirrors author_id's optional-field convention in NotesTab.tsx).
  const noteId = initialNote && typeof initialNote.id === 'string' ? initialNote.id : undefined
  // One seed for all fields: a draft handed over from another window wins, else
  // the note being edited. Both fill the SAME fields — only `isNew` differs.
  // The five fields themselves live in the shared useNoteFields/NoteFields pair
  // (NOTITIE-POPOUT-URL-1: the per-note window shows the same form — one
  // implementation, no second form to drift, §11).
  const seed = initialDraft
    ? { type: initialDraft.type, channel: initialDraft.channel, title: initialDraft.title, body: initialDraft.body, language: initialDraft.language }
    : { type: initialNote?.type ?? '', channel: initialNote?.channel ?? '', title: initialNote?.title ?? '', body: initialNote?.text ?? initialNote?.body ?? '', language: initialNote?.language }
  const fields = useNoteFields(seed, noteTypes)

  const save = () => onSave(fields.payload)
  // Only a NEW note is handed over from HERE: a draft carries no note id, so a
  // window receiving one saves it as a new note. An existing note has its own,
  // id-based route to the second screen since NOTITIE-POPOUT-EDIT-1 — the pop-out
  // icon beside that note's pencil/bin in the list — so this composer keeps showing
  // none while editing, rather than a button that would duplicate the note.
  const canHandOff = Boolean(onPopOutDraft) && isNew
  // Hand the WHOLE composed note over; the host waits for the window's ack.
  const popOut = () => onPopOutDraft?.({ type: fields.type, channel: fields.channel, title: fields.title, body: fields.body, language: fields.language })
  // FloatingPanel wants a plain string; every host's newNote/edit label is one
  // in practice (ReactNode on the type only because DrawerAddButton's `label`
  // slot accepts richer content elsewhere) — coerce defensively, never throw.
  const rawTitle = isNew ? labels.newNote : labels.edit
  const panelTitle = typeof rawTitle === 'string' ? rawTitle : String(rawTitle ?? '')

  // No `onPopOut` on the panel any more (NOTITIE-POPOUT-HANDOFF-1): the
  // second-screen icon moved out of the window's title bar into the note block.
  return (
    <FloatingPanel open={open} onClose={onCancel} title={panelTitle} ariaLabel={panelTitle}
      persistKey="notes-composer" width={640} maxWidth="92vw" scrollBody={false}>
      {/* Scrollable content — RichTextEditor (fill) is the ONE growing item, so
          dragging the panel bigger grows the WRITING space, never empty
          whitespace below a stuck-size editor. `overflow: auto` is the safety
          net the other way: if the panel is smaller than everything put
          together, this scrolls instead of clipping. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Host-supplied composer row (e.g. the customer tab's link-level picker) —
            sits ABOVE the type row because the picked scope drives the type list. */}
        {isNew && composerExtra}
        {/* The five shared fields (type · channel · title · editor · assist) — the
            SAME NoteFields the per-note popout window renders. The pop-out icon
            rides the title row via titleExtra, NEW notes only (see canHandOff). */}
        <NoteFields fields={fields} noteTypes={noteTypes} channels={channels} labels={labels}
          editorLabels={editorLabels} noteId={noteId} editorMinHeight={160}
          titleExtra={canHandOff ? (
            <Button variant="secondary" size="sm" iconOnly onClick={popOut} disabled={popOutPending} aria-busy={popOutPending}
              title={t('openSecondScreen')} aria-label={t('openSecondScreen')}>
              <ExternalLink size={13} />
            </Button>
          ) : undefined} />
      </div>

      {/* Pinned footer — OUTSIDE the scroll area (mirrors AddTaskModal's
          scrollBody=false footer), always reachable regardless of scroll position. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {/* MAAT (r5 finding 1): drawer buttons ride the sm standard — md is the
            page-toolbar exception only. */}
        {/* aria-label is TOTAL (the Button type demands it): labels.save/cancel are
            optional host overrides, so the common keys are the guaranteed floor. */}
        <Button variant="primary" iconOnly onClick={save} title={labels.save ?? t('save')} aria-label={labels.save ?? t('save')}><Save size={14} /></Button>
        <Button variant="secondary" iconOnly onClick={onCancel} title={labels.cancel ?? t('cancel')} aria-label={labels.cancel ?? t('cancel')}><X size={14} /></Button>
      </div>
    </FloatingPanel>
  )
}
