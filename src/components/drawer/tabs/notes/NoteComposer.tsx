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
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Save, X } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextAssistBar from '@/components/ui/RichTextAssistBar'
import NoteAssistSection from './NoteAssistSection'
import { CHANNEL_ICON } from './channelIcons'
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

const iconBtn: CSSProperties = { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }
// Pop-out icon — byte-for-byte the profile text's own affordance (ProfileTab):
// 26x26, bordered, muted, no fill. One affordance, one look (§4).
const popOutBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0 }

export default function NoteComposer({ open, initialNote, noteTypes, channels, labels, editorLabels, composerExtra, onPopOutDraft, popOutPending, initialDraft, onSave, onCancel }: NoteComposerProps) {
  const { t } = useTranslation('common')
  const isNew = initialNote == null
  // Existing note's own id (K0-B execute source) — a NoteItem's index signature
  // carries it at runtime even though the shared type doesn't declare it
  // (mirrors author_id's optional-field convention in NotesTab.tsx).
  const noteId = initialNote && typeof initialNote.id === 'string' ? initialNote.id : undefined
  // One seed for all fields: a draft handed over from another window wins, else
  // the note being edited. Both fill the SAME fields — only `isNew` differs.
  const seed = initialDraft
    ? { type: initialDraft.type, channel: initialDraft.channel, title: initialDraft.title, body: initialDraft.body, language: initialDraft.language }
    : { type: initialNote?.type ?? '', channel: initialNote?.channel ?? '', title: initialNote?.title ?? '', body: initialNote?.text ?? initialNote?.body ?? '', language: initialNote?.language }
  const [type, setType] = useState(seed.type || noteTypes[0]?.value || '')
  const [channel, setChannel] = useState(seed.channel)
  const [title, setTitle] = useState(seed.title)
  const [body, setBody] = useState(seed.body)
  // NOTE-TAAL-1: prefilled from the note being edited; undefined for a new note
  // (RichTextEditor then falls back to the app's own locale — its normal default).
  const [language, setLanguage] = useState<string | undefined>(seed.language)

  // Resync when the host swaps the writable type list mid-compose (the customer
  // tab's link-level picker switches scope INSIDE the composer) — a stale type
  // from the previous scope would 422 on save. Unchanged from the old inline
  // composer's own effect, just relocated.
  useEffect(() => {
    if (noteTypes.length === 0 || noteTypes.some(nt => nt.value === type)) return
    setType(noteTypes[0].value)
  }, [noteTypes, type])

  const typeLabel = noteTypes.find(n => n.value === type)?.label ?? ''
  const save = () => onSave({ type, title, body, channel: channel || undefined, language: language || undefined })
  // Only a NEW note can be handed to the second screen: a draft carries no note
  // id, so a window receiving one saves it as a new note. Rather than a button
  // that would silently duplicate (or drop) an edit, an edit shows none at all
  // (§3, no fake affordance) — the toolbar pop-out still opens the thread there.
  const canHandOff = Boolean(onPopOutDraft) && isNew
  // Hand the WHOLE composed note over; the host waits for the window's ack.
  const popOut = () => onPopOutDraft?.({ type, channel, title, body, language })
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
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{labels.type}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {/* §4 soft-tint: active is tinted (never a solid fill), inactive uses the surface token. */}
            {noteTypes.map(nt => (
              <button key={nt.value} onClick={() => setType(nt.value)}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer',
                  border: `1px solid ${type === nt.value ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                  background: type === nt.value ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--surface)',
                  color: type === nt.value ? 'var(--color-primary)' : 'var(--text)', fontWeight: type === nt.value ? 600 : 400 }}>
                {nt.label}
              </button>
            ))}
          </div>
        </div>
        {/* Contact channel — optional; picking one marks this note a contact moment.
            No "internal" button: no channel selected = internal note (that's the note TYPE). */}
        {channels.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{labels.channel}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {channels.map(ch => {
                const active = channel === ch.value
                const col = ch.color ?? 'var(--color-primary)'
                const Icon = CHANNEL_ICON[ch.value]
                return (
                  <button key={ch.value} type="button" onClick={() => setChannel(active ? '' : ch.value)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11,
                      fontWeight: active ? 600 : 500, borderRadius: 99, cursor: 'pointer', color: col,
                      background: `color-mix(in srgb, ${col} ${active ? 16 : 8}%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${col} ${active ? 50 : 28}%, transparent)` }}>
                    {Icon && <Icon size={12} />} {ch.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {/* Title row OF THE NOTE BLOCK — the pop-out icon lives here now, directly
            above the editor and part of the content, exactly like the profile
            text's own title row (Danny 09/10-08). Hidden while editing an existing
            note: see canHandOff. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={labels.notePlaceholder?.(typeLabel)}
            style={{ flex: 1, minWidth: 0, padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
          {canHandOff && (
            <button type="button" onClick={popOut} disabled={popOutPending} aria-busy={popOutPending}
              title={t('openSecondScreen')} aria-label={t('openSecondScreen')}
              style={{ ...popOutBtn, opacity: popOutPending ? 0.5 : 1, cursor: popOutPending ? 'default' : 'pointer' }}>
              <ExternalLink size={13} />
            </button>
          )}
        </div>
        {/* TAAL-SPELL-1: language/onLanguageChange controlled here so the pick rides
            into the save payload. NOTITIE-VOICE-1 (Danny 08-08 "mic naast de taal,
            tenant kleur"): the dictation mic rides the editor's own toolbar slot,
            directly next to the language picker — one `language` state drives both
            the spellcheck AND the recognition locale. No expand button (Danny
            08-08): the FloatingPanel itself resizes, the toggle did nothing useful.
            `fill` + a real minHeight floor: the editor is the flexible item that
            absorbs a bigger/smaller panel (see the RESIZE-GROWS-EDITOR docblock). */}
        <RichTextEditor value={body} onChange={setBody}
          assist={false}
          toolbarExtra={<RichTextAssistBar value={body} onChange={setBody} language={language} modes={[]} />}
          labels={editorLabels} language={language} onLanguageChange={setLanguage} fill minHeight={160} />

        {/* NOTE-ASSIST-1: Koios AI assist — always visible under the editor. */}
        <NoteAssistSection body={body} onApply={setBody} language={language} noteId={noteId} />
      </div>

      {/* Pinned footer — OUTSIDE the scroll area (mirrors AddTaskModal's
          scrollBody=false footer), always reachable regardless of scroll position. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={save} title={labels.save}
          style={{ ...iconBtn, background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }}><Save size={15} /></button>
        <button onClick={onCancel} title={labels.cancel}
          style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={15} /></button>
      </div>
    </FloatingPanel>
  )
}
