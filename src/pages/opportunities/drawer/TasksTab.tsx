import { useTranslation } from 'react-i18next'
import { ListChecks, AlertTriangle } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import { useOpportunityTasks } from '../hooks/useOpportunityTasks'
import type { Opportunity } from '@/types/opportunity'

/**
 * TasksTab — the tasks linked to this opportunity (read-only). Data via
 * /opportunities/{id}/tasks (C-42). Handles the four UI states explicitly.
 */
export default function TasksTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')
  const { formatDate } = useDateFormat()
  const { items, loading, error } = useOpportunityTasks(o?.id)

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('tasks.loading')}</div>
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
      <AlertTriangle size={14} /> {t('tasks.error')}
    </div>
  )
  if (items.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
      <ListChecks size={22} style={{ opacity: 0.5 }} />
      <span style={{ fontSize: 12 }}>{t('tasks.empty')}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((task, i) => {
        // The API now sends `status` as a lookup OBJECT ({value,label,color,is_done});
        // older payloads sent a bare string — resolve both, never render the object raw.
        const st = task.status as { label?: string; value?: string; color?: string } | string | null | undefined
        const statusLabel = task.status_label ?? (typeof st === 'object' ? st?.label ?? st?.value : st)
        const color = task.status_color || (typeof st === 'object' ? st?.color : null) || '#9CA3AF'
        const due = task.due_at ?? task.due_date
        return (
          <div key={task.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{task.title || '—'}</div>
              {(task.owner_name || due) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {[task.owner_name, due ? formatDate(due) : null].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            {statusLabel && (
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                background: color + '1A', color, border: `1px solid ${color}55` }}>
                {statusLabel}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
