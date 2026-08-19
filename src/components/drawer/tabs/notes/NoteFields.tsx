/**
 * NoteFields — the note WRITING surface: type chips, contact-channel chips, the
 * title row, the rich-text editor (language picker + dictation mic) and the Koios
 * assist section. Purely presentational; the field state lives in `useNoteFields`
 * and the persistence in whichever screen mounts this (§3).
 *
 * Extracted out of NoteComposer for NOTITIE-POPOUT-URL-1 (Danny 11-08): the
 * per-note second-screen window edits a note on a route of its own and must show
 * the SAME five fields the drill-down popup shows. Two forms for one note is how
 * they drift apart, so there is one — the composer wraps it in its FloatingPanel,
 * the popout window wraps it in a full-window column (§11).
 *
 * NOTITIE-VOICE-1 / KOIOS-ASSIST-TEXTFIELDS: the editor's own assist is switched
 * off (`assist={false}`) and the shared RichTextAssistBar rides its toolbar slot in
 * `modes={[]}` (mic only), because a note's Koios actions live in the richer
 * NoteAssistSection below — it adds action-item extraction + the K0-B execute
 * bridge, which only make sense for a note.
 */
import type { ReactNode } from 'react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextAssistBar from '@/components/ui/RichTextAssistBar'
import NoteAssistSection from './NoteAssistSection'
import { CHANNEL_ICON } from './channelIcons'
import type { NoteFieldsState } from './useNoteFields'
import type { NoteType, NotesLabels } from '../NotesTab'

interface NoteFieldsProps {
  // The field state — one `useNoteFields(...)` return, passed whole.
  fields: NoteFieldsState
  noteTypes: NoteType[]
  channels: NoteType[]
  labels: NotesLabels
  editorLabels?: Record<string, string>
  // Existing note's own id — the K0-B execute source in NoteAssistSection.
  // Absent while composing a NEW note (it has no id yet).
  noteId?: string
  // Trailing slot in the TITLE row (the composer's pop-out icon). Omitted where a
  // screen has nothing to put there — the popout window itself, for one.
  titleExtra?: ReactNode
  // Minimum editor height — the drill-down popup and the full window want a
  // different floor for the same component.
  editorMinHeight?: number
}

export default function NoteFields({ fields, noteTypes, channels, labels, editorLabels, noteId, titleExtra, editorMinHeight = 160 }: NoteFieldsProps) {
  const { type, setType, channel, setChannel, title, setTitle, body, setBody, language, setLanguage } = fields
  const typeLabel = noteTypes.find(n => n.value === type)?.label ?? ''

  return (
    <>
      {/* Note type — §4 soft-tint: active is tinted (never a solid fill), inactive uses the surface token. */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{labels.type}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {/* HUISSTIJL-1: a generic (non-data-coloured) single-select pill — the
              SELECTED state reads the house trio, solid, same as every other
              accent selection. The channel picker below keeps ITS OWN colour per
              channel (a data colour, excluded from the trio — see its comment). */}
          {noteTypes.map(nt => (
            <button key={nt.value} type="button" onClick={() => setType(nt.value)}
              style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 99, cursor: 'pointer',
                border: `1px solid ${type === nt.value ? 'var(--button-border)' : 'var(--border)'}`,
                background: type === nt.value ? 'var(--button-fill)' : 'var(--surface)',
                color: type === nt.value ? 'var(--button-ink)' : 'var(--text)', fontWeight: type === nt.value ? 600 : 400 }}>
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
            {/* PICKER contrast: only the SELECTED chip wears its channel colour; the rest
                sit neutral on --surface/--border — the exact treatment the Type row above
                uses. Every chip tinted in its own colour made 16%-blue vs 8%-green an
                impossible comparison, so the selection was invisible. The icon stays on
                every chip (colour is never the only signal) and aria-pressed exposes the
                selection to screen readers (§6). The note LIST chip keeps its own colour —
                there the colour answers "which channel was this". */}
            {channels.map(ch => {
              const active = channel === ch.value
              const col = ch.color ?? 'var(--color-primary)'
              const Icon = CHANNEL_ICON[ch.value]
              return (
                <button key={ch.value} type="button" aria-pressed={active} onClick={() => setChannel(active ? '' : ch.value)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11.5,
                    fontWeight: active ? 600 : 500, borderRadius: 99, cursor: 'pointer',
                    color: active ? col : 'var(--text-muted)',
                    background: active ? `color-mix(in srgb, ${col} 16%, transparent)` : 'var(--surface)',
                    border: active ? `1px solid color-mix(in srgb, ${col} 50%, transparent)` : '1px solid var(--border)' }}>
                  {Icon && <Icon size={12} />} {ch.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Title row — directly above the editor and part of the content, exactly like
          the profile text's own title row (Danny 09/10-08). `titleExtra` is the slot
          the host fills (the composer's pop-out icon). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={labels.notePlaceholder?.(typeLabel)}
          style={{ flex: 1, minWidth: 0, padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
        {titleExtra}
      </div>

      {/* TAAL-SPELL-1: language/onLanguageChange controlled by the field hook, so the
          pick rides into the save payload. `fill` + a real minHeight floor: the editor
          is the flexible item that absorbs a bigger/smaller panel or window. */}
      <RichTextEditor value={body} onChange={setBody}
        assist={false}
        toolbarExtra={<RichTextAssistBar value={body} onChange={setBody} language={language} modes={[]} />}
        labels={editorLabels} language={language} onLanguageChange={setLanguage} fill minHeight={editorMinHeight} />

      {/* NOTE-ASSIST-1: Koios AI assist — always visible under the editor. */}
      <NoteAssistSection body={body} onApply={setBody} language={language} noteId={noteId} />
    </>
  )
}
