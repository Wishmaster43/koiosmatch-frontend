import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useDateFormat } from '@/lib/datetime'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

interface Note { id: Id | undefined; author: string; text: string; time: string }

/**
 * NotesTab — internal notes on the vacancy with a composer. Posts to
 * /vacancies/{id}/notes optimistically; a missing endpoint fails softly (the note
 * stays locally). Mirrors the candidate notes UX, lean.
 */
export default function NotesTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { formatDate } = useDateFormat()
  const [notes, setNotes] = useState<Note[]>((v.notes ?? []) as Note[])
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  // Add a note: optimistic prepend, then persist (silent soft-fail).
  const save = () => {
    const body = text.trim()
    if (!body) return
    const tmp: Note = { id: -Date.now(), author: '', text: body, time: new Date().toISOString() }
    setNotes(n => [tmp, ...n]); setText(''); setAdding(false)
    api.post(`/vacancies/${v.id}/notes`, { text: body })
      .then(r => { const it = r?.data?.data ?? r?.data; if (it?.id) setNotes(n => n.map(x => x.id === tmp.id ? { ...tmp, ...it, time: it.created_at ?? tmp.time } : x)) })
      .catch(() => notifyError(t('common:actionFailed')))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('drawer.tabs.notes')}</span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> {t('bulk.addNote')}
          </button>
        )}
      </div>

      {adding && (
        <div style={{ marginBottom: 12 }}>
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={t('bulk.notePlaceholder')}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, outline: 'none', resize: 'vertical', color: 'var(--text)', background: 'var(--input-bg)' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={save} disabled={!text.trim()}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', opacity: text.trim() ? 1 : 0.5 }}>{t('bulk.noteSubmit')}</button>
            <button onClick={() => { setText(''); setAdding(false) }}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 7, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('modal.cancel')}</button>
          </div>
        </div>
      )}

      {notes.length === 0 && !adding ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('applicants.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map(n => (
            <div key={n.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar initials={(n.author?.[0] ?? '?').toUpperCase()} size={22} soft />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.author || '—'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDate(n.time)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
