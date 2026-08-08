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
 * NOTITIE-VOICE-1 (Danny 06-08 "dictatietaal = editortaal"): a mic button sits
 * directly above the editor, right-aligned — near its own language picker
 * (RichTextEditor's toolbar is out of this file's scope, so the mic lives just
 * outside it rather than inside that shared component). Reuses the SAME
 * `KoiosVoiceButton` the chat composer uses (generalised for reuse, §11 one
 * source) — its `lang` prop is fed the CONTROLLED `language` state above, so
 * dictation always follows the editor's own picked language, never the app's
 * UI locale. Honest states (unsupported browser hidden, denied-mic title) are
 * inherited from the shared component — nothing extra to build here. Each
 * recognized chunk is escaped and appended as a new paragraph (never
 * dangerouslySetInnerHTML with raw speech text, §7).
 */
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import RichTextEditor from '@/components/ui/RichTextEditor'
import KoiosVoiceButton from '@/components/layout/koios/KoiosVoiceButton'
import NoteAssistSection from './NoteAssistSection'
import { CHANNEL_ICON } from './channelIcons'
import { escapeHtml } from './noteAssistApply'
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
  // F5 second-screen: host-supplied pop-out handler — forwarded to FloatingPanel's
  // header button. Only candidate hosts pass it today (the popout window is
  // candidate-only); the popout window itself never does (no recursion).
  onPopOut?: () => void
  onSave: (payload: NotePayload) => void
  onCancel: () => void
}

const iconBtn: CSSProperties = { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }

export default function NoteComposer({ open, initialNote, noteTypes, channels, labels, editorLabels, composerExtra, onPopOut, onSave, onCancel }: NoteComposerProps) {
  const { t } = useTranslation()
  const isNew = initialNote == null
  // Existing note's own id (K0-B execute source) — a NoteItem's index signature
  // carries it at runtime even though the shared type doesn't declare it
  // (mirrors author_id's optional-field convention in NotesTab.tsx).
  const noteId = initialNote && typeof initialNote.id === 'string' ? initialNote.id : undefined
  const [type, setType] = useState(initialNote?.type ?? noteTypes[0]?.value ?? '')
  const [channel, setChannel] = useState(initialNote?.channel ?? '')
  const [title, setTitle] = useState(initialNote?.title ?? '')
  const [body, setBody] = useState(initialNote?.text ?? initialNote?.body ?? '')
  // NOTE-TAAL-1: prefilled from the note being edited; undefined for a new note
  // (RichTextEditor then falls back to the app's own locale — its normal default).
  const [language, setLanguage] = useState<string | undefined>(initialNote?.language ?? undefined)

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
  // NOTITIE-VOICE-1: append a dictated chunk as its own escaped paragraph —
  // never splice raw speech text into the existing HTML (§7), and never lose
  // whatever the recruiter already wrote (append-only, mirrors the chat mic's
  // own "always append" idiom, KoiosPanel's appendVoiceText).
  const appendVoiceText = (chunk: string) => setBody(prev => `${prev}<p>${escapeHtml(chunk)}</p>`)
  // FloatingPanel wants a plain string; every host's newNote/edit label is one
  // in practice (ReactNode on the type only because DrawerAddButton's `label`
  // slot accepts richer content elsewhere) — coerce defensively, never throw.
  const rawTitle = isNew ? labels.newNote : labels.edit
  const panelTitle = typeof rawTitle === 'string' ? rawTitle : String(rawTitle ?? '')

  return (
    <FloatingPanel open={open} onClose={onCancel} title={panelTitle} ariaLabel={panelTitle}
      persistKey="notes-composer" width={640} maxWidth="92vw" scrollBody={false} onPopOut={onPopOut}>
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
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={labels.notePlaceholder?.(typeLabel)}
          style={{ width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none', flexShrink: 0 }} />
        {/* TAAL-SPELL-1: language/onLanguageChange controlled here so the pick rides
            into the save payload. NOTITIE-VOICE-1 (Danny 08-08 "mic naast de taal,
            tenant kleur"): the dictation mic rides the editor's own toolbar slot,
            directly next to the language picker — one `language` state drives both
            the spellcheck AND the recognition locale. No expand button (Danny
            08-08): the FloatingPanel itself resizes, the toggle did nothing useful.
            `fill` + a real minHeight floor: the editor is the flexible item that
            absorbs a bigger/smaller panel (see the RESIZE-GROWS-EDITOR docblock). */}
        <RichTextEditor value={body} onChange={setBody}
          toolbarExtra={<KoiosVoiceButton onText={appendVoiceText} lang={language} t={t} tone="primary" />}
          labels={editorLabels} language={language} onLanguageChange={setLanguage} fill minHeight={160} />

        {/* NOTE-ASSIST-1: Koios AI assist — always visible under the editor. */}
        <NoteAssistSection body={body} onApply={setBody} language={language} noteId={noteId} />
      </div>

      {/* Pinned footer — OUTSIDE the scroll area (mirrors AddTaskModal's
          scrollBody=false footer), always reachable regardless of scroll position. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={save} title={labels.save}
          style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={15} /></button>
        <button onClick={onCancel} title={labels.cancel}
          style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={15} /></button>
      </div>
    </FloatingPanel>
  )
}
