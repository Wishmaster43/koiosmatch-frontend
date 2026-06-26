import { useTranslation } from 'react-i18next'
import { useDateFormat } from '../../../lib/datetime'
import type { TaskDetail } from '../../../types/task'

/**
 * ActivityTab — the task changelog (status/field changes with their date + author),
 * from GET /tasks/{id}/activity. Read-only timeline; empty state when nothing yet.
 */
export default function ActivityTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const items = task.activity ?? []

  if (items.length === 0) {
    return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('activity.empty')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((ev, i) => (
        <div key={ev.id ?? i} style={{ display: 'flex', gap: 10, paddingBottom: 14 }}>
          {/* Dot + connector line */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', marginTop: 4 }} />
            {i < items.length - 1 && <span style={{ flex: 1, width: 1, background: 'var(--border)', marginTop: 2 }} />}
          </div>
          <div style={{ minWidth: 0, paddingBottom: 2 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{ev.description}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {[ev.author, ev.time ? formatDate(ev.time) : ''].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
