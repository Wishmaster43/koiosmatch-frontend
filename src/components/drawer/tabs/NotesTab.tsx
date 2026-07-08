/**
 * NotesTab — generic communication tab: notes (with a rich-text composer) +
 * timeline + conversations. Entity-agnostic; data + labels via props so it works
 * for candidates, customers, vacancies, tasks alike.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode, ComponentType } from 'react'
import { Plus, Edit2, Save, X, Mail, PhoneCall, MessageCircle, Building2, Video, FileText, History } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SafeHtml from '@/components/ui/SafeHtml'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SectionCard, { sectionBlock } from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { SYSTEM_NOTE_TYPES } from '@/lib/useNoteTypes'

interface NoteType { value: string; label: string; color?: string }
interface NoteItem { type?: string; channel?: string; title?: string; author?: string; author_name?: string; created_by?: string | { name?: string }; updated_by?: string | { name?: string }; edited_by?: string; text?: string; body?: string; ago?: string; created_at?: string; updated_at?: string; [k: string]: unknown }
interface TimelineItem { time?: string; created_at?: string; text?: string; description?: string; [k: string]: unknown }
interface NotesLabels {
  notes?: ReactNode; newNote?: ReactNode; type?: ReactNode; channel?: ReactNode; channelNone?: ReactNode; save?: string; cancel?: string; edit?: string
  notesEmpty?: ReactNode; timeline?: ReactNode; timelineEmpty?: ReactNode
  conversations?: ReactNode; conversationsEmpty?: ReactNode
  notePlaceholder?: (typeLabel: string) => string
}
interface NotePayload { type: string; title: string; body: string; channel?: string }

// Icon per contact-channel slug — shown on the picker + the chip (mirrors CandidatesTable).
const CHANNEL_ICON: Record<string, ComponentType<{ size?: number }>> = {
  email: Mail, phone: PhoneCall, call: PhoneCall, whatsapp: MessageCircle,
  whatsapp_private: MessageCircle, appointment: Building2, meet: Video, note: FileText,
}

interface NotesTabProps {
  notes?: NoteItem[]
  timeline?: TimelineItem[]
  noteTypes?: NoteType[]
  // Optional contact channels (last_contact_types). Picking one marks the note a
  // contact moment → the backend stamps last_contact_at/_type/_by. Empty = internal note.
  channels?: NoteType[]
  labels?: NotesLabels
  editorLabels?: Record<string, string>
  authorInitials?: string
  timelineName?: ReactNode
  timelineInitials?: string
  onAddNote?: (payload: NotePayload) => void
  onEditNote?: (i: number, payload: NotePayload) => void
  // Optional section toggles — hosts with their own sub-tabs render one section at a time.
  showNotes?: boolean
  showTimeline?: boolean
  showConversations?: boolean
}

export default function NotesTab({
  notes = [], timeline = [], noteTypes = [], channels = [], labels = {}, editorLabels,
  authorInitials, timelineName, timelineInitials, onAddNote, onEditNote,
  showNotes = true, showTimeline = true, showConversations = true,
}: NotesTabProps) {
  const [adding, setAdding]   = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)   // null = new; index = editing
  const [body, setBody]       = useState('')
  const [title, setTitle]     = useState('')
  const [type, setType]       = useState(noteTypes[0]?.value ?? '')
  // Optional contact channel — empty = internal note (no contact moment).
  const [channel, setChannel] = useState('')
  const [expanded, setExpanded] = useState(false)
  const { formatDate } = useDateFormat()
  // Note timestamp: real date+time when the note carries one, else the relative "ago".
  const noteWhen = (n: NoteItem) => n.created_at
    ? formatDate(n.created_at as string, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : n.ago
  // Note author ("by whom"): the note's own author, from any of the API shapes.
  const noteAuthor = (n: NoteItem) =>
    (typeof n.created_by === 'object' ? n.created_by?.name : n.created_by) ?? n.author_name ?? n.author ?? ''
  // Editor ("edited by") — shown only once the backend logs it (NOTES-2b); graceful until then.
  const noteEditor = (n: NoteItem) =>
    (typeof n.updated_by === 'object' ? n.updated_by?.name : n.updated_by) ?? n.edited_by ?? ''
  const noteEdited = (n: NoteItem) => Boolean(noteEditor(n) && n.updated_at && n.updated_at !== n.created_at)
  // System notes (backend-written status/phase changes) render as a calm event row —
  // no avatar, no edit pencil, just the "Statuswissel" chip + who/when (N-1-FE).
  const isSystemNote = (n: NoteItem) => Boolean(n.is_system) || SYSTEM_NOTE_TYPES.has(String(n.type ?? ''))

  const reset = () => { setAdding(false); setEditingIdx(null); setBody(''); setTitle(''); setType(noteTypes[0]?.value ?? ''); setChannel(''); setExpanded(false) }
  const openEdit = (i: number) => {
    const n = notes[i]
    setType(n.type ?? noteTypes[0]?.value ?? ''); setChannel(n.channel ?? ''); setTitle(n.title ?? ''); setBody(n.text ?? n.body ?? '')
    setEditingIdx(i); setAdding(true)
  }
  const save = () => {
    const payload: NotePayload = { type, title, body, channel: channel || undefined }
    if (editingIdx == null) onAddNote?.(payload)
    else onEditNote?.(editingIdx, payload)
    reset()
  }
  const typeLabel = noteTypes.find(n => n.value === type)?.label ?? ''
  const iconBtn: CSSProperties = { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }

  // Note-type chip: resolves value→label and uses the lookup's soft colour when set.
  const renderTypeChip = (value: string) => {
    const nt = noteTypes.find(n => n.value === value || n.label === value)
    const col = nt?.color
    const soft: CSSProperties = col
      ? { background: col + '1A', color: col, border: `1px solid ${col}55` }
      : { background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, marginRight: 6, ...soft }}>{nt?.label ?? value}</span>
  }

  // Channel chip — resolves value→label from the contact-channel lookup; soft tint.
  const renderChannelChip = (value: string) => {
    const ch = channels.find(c => c.value === value || c.label === value)
    const col = ch?.color ?? 'var(--color-secondary)'
    const isHex = typeof col === 'string' && col.startsWith('#')
    const soft: CSSProperties = isHex
      ? { background: col + '1A', color: col, border: `1px solid ${col}55` }
      : { background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)` }
    const Icon = CHANNEL_ICON[value]
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, marginRight: 6, ...soft }}>{Icon && <Icon size={10} />}{ch?.label ?? value}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Notes */}
      {showNotes && (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{labels.notes}</span>
          {!adding && (
            <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Plus size={11} /> {labels.newNote}
            </button>
          )}
        </div>
        <div style={sectionBlock}>
        {adding && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{labels.type}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {noteTypes.map(nt => (
                  <button key={nt.value} onClick={() => setType(nt.value)}
                    style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer',
                      border: `1px solid ${type === nt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                      background: type === nt.value ? 'var(--color-primary)' : 'white',
                      color: type === nt.value ? 'white' : 'var(--text)', fontWeight: type === nt.value ? 600 : 400 }}>
                    {nt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Contact channel — optional; picking one marks this note a contact moment.
                No "internal" button: no channel selected = internal note (that's the note TYPE).
                Soft-chip toggle (§4) with an icon; click a selected channel again to clear it. */}
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
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
            <RichTextEditor value={body} onChange={setBody} expanded={expanded} onToggleExpand={() => setExpanded(e => !e)} labels={editorLabels} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button onClick={save} title={labels.save}
                style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={15} /></button>
              <button onClick={reset} title={labels.cancel}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={15} /></button>
            </div>
          </div>
        )}
        {notes.length === 0 && !adding
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.notesEmpty}</div>
          : notes.map((n, i) => {
              const who = noteAuthor(n)
              // System event (status/phase change) — calm one-line row, no avatar/pencil.
              if (isSystemNote(n)) return (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                    <History size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                    {n.type && renderTypeChip(n.type)}
                    <SafeHtml style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0 }} html={n.text ?? n.body ?? ''} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{who ? `${who} · ` : ''}{noteWhen(n)}</span>
                  </div>
                </div>
              )
              return (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Avatar initials={who ? initialsOf(who) : authorInitials} size={26} />
                <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      {n.type && renderTypeChip(n.type)}
                      {n.channel && renderChannelChip(n.channel)}
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.title ?? who}</span>
                    </div>
                    {/* "By whom · when" (always) + "edited by X" once the backend logs it (NOTES-2b). */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {who ? `${who} · ` : ''}{noteWhen(n)}
                      {noteEdited(n) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} title={labels.edit as string}>
                          <Edit2 size={9} /> {noteEditor(n)}
                        </span>
                      )}
                    </span>
                    {onEditNote && (
                      <button onClick={() => openEdit(i)} title={labels.edit}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px', display: 'flex' }}>
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                  <SafeHtml style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} html={n.text ?? n.body ?? ''} />
                </div>
              </div>
            )})
        }
      </div>
      </div>
      )}

      {/* Timeline */}
      {showTimeline && (
      <SectionCard title={labels.timeline}>
        {timeline.length > 0
          ? timeline.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
                <Avatar initials={timelineInitials} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{timelineName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.time ?? ev.created_at}</span>
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)' }}>{ev.text ?? ev.description}</div>
                </div>
              </div>
            ))
          : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.timelineEmpty}</div>
        }
      </SectionCard>
      )}

      {/* Conversations */}
      {showConversations && (
      <SectionCard title={labels.conversations}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.conversationsEmpty}</div>
      </SectionCard>
      )}
    </div>
  )
}
