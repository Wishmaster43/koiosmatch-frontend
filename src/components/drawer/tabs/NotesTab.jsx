/**
 * NotesTab — generic communication tab: notes (with a rich-text composer) +
 * timeline + conversations. Entity-agnostic; data + labels via props so it works
 * for candidates, customers, vacancies, tasks alike.
 *
 * noteTypes: [{ value, label }]
 * labels: { notes, newNote, type, save, cancel, notesEmpty, timeline,
 *           timelineEmpty, conversations, conversationsEmpty, notePlaceholder(fn) }
 */
import { useState } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import Avatar from '../../ui/Avatar'
import SafeHtml from '../../ui/SafeHtml'
import RichTextEditor from '../../ui/RichTextEditor'
import SectionCard, { sectionBlock } from '../../ui/SectionCard'

export default function NotesTab({
  notes = [], timeline = [], noteTypes = [], labels = {}, editorLabels,
  authorInitials, timelineName, timelineInitials, onAddNote,
}) {
  const [adding, setAdding]   = useState(false)
  const [body, setBody]       = useState('')
  const [title, setTitle]     = useState('')
  const [type, setType]       = useState(noteTypes[0]?.value ?? '')
  const [expanded, setExpanded] = useState(false)

  const reset = () => { setAdding(false); setBody(''); setTitle(''); setType(noteTypes[0]?.value ?? ''); setExpanded(false) }
  const save = () => { onAddNote?.({ type, title, body }); reset() }
  const typeLabel = noteTypes.find(n => n.value === type)?.label ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Notes */}
      <div style={sectionBlock}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{labels.notes}</span>
          {!adding && (
            <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Plus size={11} /> {labels.newNote}
            </button>
          )}
        </div>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={reset} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{labels.cancel}</button>
              <button onClick={save} style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, borderRadius: 8, background: 'var(--text)', color: 'white', border: 'none', cursor: 'pointer' }}>{labels.save}</button>
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
                      {n.type && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', marginRight: 6 }}>{n.type}</span>}
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.title ?? n.author}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.ago}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px' }}><MoreHorizontal size={14} /></button>
                  </div>
                  <SafeHtml style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} html={n.text ?? n.body ?? ''} />
                </div>
              </div>
            ))
        }
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
