import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SafeHtml from '@/components/ui/SafeHtml'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useDateFormat } from '@/lib/datetime'
import type { TaskDetail } from '@/types/task'

// Strip tags to decide whether a composed comment actually holds text.
const textOf = (html: string) => html.replace(/<[^>]*>/g, '').trim()

/**
 * CommentsTab — the Reacties thread. Presentational: the page owns the data and the
 * mutation (onAdd). The composer is the same rich-text editor as the notes pads
 * (Danny 2026-07-04: "reacties moet wel echte teksteditor zijn zoals notities").
 */
export default function CommentsTab({ task, onAdd }: { task: TaskDetail; onAdd: (text: string) => void }) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const [body, setBody] = useState('')
  const [expanded, setExpanded] = useState(false)
  const comments = task.comments ?? []

  const submit = () => {
    if (!textOf(body)) return
    onAdd(body)
    setBody(''); setExpanded(false)
  }

  return (
    <div>
      {/* Composer — rich text (HTML out), mirrors the notes editor. */}
      <div style={{ marginBottom: 16 }}>
        <RichTextEditor value={body} onChange={setBody} expanded={expanded} onToggleExpand={() => setExpanded(e => !e)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={submit} disabled={!textOf(body)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: textOf(body) ? 'pointer' : 'not-allowed',
              background: textOf(body) ? 'var(--color-primary)' : '#E5E7EB', color: textOf(body) ? '#fff' : '#9CA3AF' }}>
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
                {/* Rich comments render sanitized; legacy plain-text keeps its line breaks. */}
                {(c.body ?? '').includes('<')
                  ? <SafeHtml style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }} html={c.body ?? ''} />
                  : <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{c.body}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
