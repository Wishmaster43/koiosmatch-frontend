import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Save, X, FileText } from 'lucide-react'
import Avatar from '../../../components/ui/Avatar'

/**
 * NotesTab — internal notes for an application. Notes-only (the drawer has a
 * separate Timeline tab), with a lightweight composer. Local optimistic add for
 * now; persistence lands with the applications detail endpoint (C-23).
 */
export default function NotesTab({ application: a }) {
  const { t } = useTranslation('applications')
  const [notes, setNotes] = useState(a.notes ?? [])
  const [adding, setAdding] = useState(false)
  const [body, setBody] = useState('')

  // Add a note locally (author/time are placeholders until the API is wired).
  const save = () => {
    if (!body.trim()) return
    setNotes(prev => [{ id: -Date.now(), author: 'Koios', text: body.trim(), time: '—' }, ...prev])
    setBody(''); setAdding(false)
  }
  const cancel = () => { setBody(''); setAdding(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('notes.title')}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notes.length}</span>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
            background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            <Plus size={12} /> {t('notes.new')}
          </button>
        )}
      </div>

      {/* Composer */}
      {adding && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg)',
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={t('notes.placeholder')} rows={3} autoFocus
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button onClick={save} title={t('notes.save')} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Save size={15} />
            </button>
            <button onClick={cancel} title={t('notes.cancel')} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* List or empty state */}
      {notes.length === 0 && !adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <FileText size={22} style={{ opacity: 0.6 }} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('notes.empty')}</div>
          <div style={{ fontSize: 12, marginTop: 4, maxWidth: 260 }}>{t('notes.hint')}</div>
        </div>
      ) : (
        notes.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 8 }}>
            <Avatar initials={(n.author?.[0] ?? '?').toUpperCase()} size={26} />
            <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.author}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.time}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
