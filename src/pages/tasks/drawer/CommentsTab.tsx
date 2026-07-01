import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { TextArea } from '@/components/forms/fields'
import { useDateFormat } from '@/lib/datetime'
import type { TaskDetail } from '@/types/task'

/**
 * CommentsTab — the Reacties thread. Presentational: the page owns the data and the
 * mutation (onAdd). Comments are appended optimistically there, so this just renders
 * the list + the composer.
 */
export default function CommentsTab({ task, onAdd }: { task: TaskDetail; onAdd: (text: string) => void }) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const [body, setBody] = useState('')
  const comments = task.comments ?? []

  const submit = () => {
    const text = body.trim()
    if (!text) return
    onAdd(text)
    setBody('')
  }

  return (
    <div>
      {/* Composer */}
      <div style={{ marginBottom: 16 }}>
        <TextArea value={body} onChange={setBody} rows={3} placeholder={t('comments.placeholder')} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={submit} disabled={!body.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: body.trim() ? 'pointer' : 'not-allowed',
              background: body.trim() ? 'var(--color-primary)' : '#E5E7EB', color: body.trim() ? '#fff' : '#9CA3AF' }}>
            <Send size={13} /> {t('comments.send')}
          </button>
        </div>
      </div>

      {/* Thread */}
      {comments.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('comments.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <Avatar initials={c.authorInitials} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.author || '—'}</span>
                  {c.time && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(c.time, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
