/**
 * NotesTab — generic communication tab: notes (with a rich-text composer) +
 * timeline + conversations. Entity-agnostic; data + labels via props so it works
 * for candidates, customers, vacancies, tasks alike.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Plus, Edit2, Save, X } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SafeHtml from '@/components/ui/SafeHtml'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SectionCard, { sectionBlock } from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'

interface NoteType { value: string; label: string; color?: string }
interface NoteItem { type?: string; title?: string; author?: string; text?: string; body?: string; ago?: string; [k: string]: unknown }
interface TimelineItem { time?: string; created_at?: string; text?: string; description?: string; [k: string]: unknown }
interface NotesLabels {
  notes?: ReactNode; newNote?: ReactNode; type?: ReactNode; save?: string; cancel?: string; edit?: string
  notesEmpty?: ReactNode; timeline?: ReactNode; timelineEmpty?: ReactNode
  conversations?: ReactNode; conversationsEmpty?: ReactNode
  notePlaceholder?: (typeLabel: string) => string
}
interface NotePayload { type: string; title: string; body: string }

interface NotesTabProps {
  notes?: NoteItem[]
  timeline?: TimelineItem[]
  noteTypes?: NoteType[]
  labels?: NotesLabels
  editorLabels?: Record<string, string>
  authorInitials?: string
  timelineName?: ReactNode
  timelineInitials?: string
  onAddNote?: (payload: NotePayload) => void
  onEditNote?: (i: number, payload: NotePayload) => void
}

export default function NotesTab({
  notes = [], timeline = [], noteTypes = [], labels = {}, editorLabels,
  authorInitials, timelineName, timelineInitials, onAddNote, onEditNote,
}: NotesTabProps) {
  const [adding, setAdding]   = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)   // null = new; index = editing
  const [body, setBody]       = useState('')
  const [title, setTitle]     = useState('')
  const [type, setType]       = useState(noteTypes[0]?.value ?? '')
  const [expanded, setExpanded] = useState(false)
  const { formatDate } = useDateFormat()
  // Note timestamp: real date+time when the note carries one, else the relative "ago".
  const noteWhen = (n: NoteItem) => n.created_at
    ? formatDate(n.created_at as string, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : n.ago

  const reset = () => { setAdding(false); setEditingIdx(null); setBody(''); setTitle(''); setType(noteTypes[0]?.value ?? ''); setExpanded(false) }
  const openEdit = (i: number) => {
    const n = notes[i]
    setType(n.type ?? noteTypes[0]?.value ?? ''); setTitle(n.title ?? ''); setBody(n.text ?? n.body ?? '')
    setEditingIdx(i); setAdding(true)
  }
  const save = () => {
    const payload: NotePayload = { type, title, body }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Notes */}
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
          : notes.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Avatar initials={authorInitials} size={26} />
                <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      {n.type && renderTypeChip(n.type)}
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.title ?? n.author}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{noteWhen(n)}</span>
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
            ))
        }
      </div>
      </div>

      {/* Timeline */}
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

      {/* Conversations */}
      <SectionCard title={labels.conversations}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.conversationsEmpty}</div>
      </SectionCard>
    </div>
  )
}
