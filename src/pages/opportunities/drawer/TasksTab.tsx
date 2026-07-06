import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, AlertTriangle, Plus } from 'lucide-react'
import AddTaskModal from '@/pages/tasks/AddTaskModal'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import { useOpportunityTasks } from '../hooks/useOpportunityTasks'
import type { Opportunity } from '@/types/opportunity'

/**
 * TasksTab — the tasks linked to this opportunity (Danny 2026-07-06: "taak toevoegen
 * kan niet? lijst oude taken?"). "+ Nieuwe taak" opens the shared modal pre-linked to
 * the opportunity, an Open/Historie toggle shows the closed ones, and each row clicks
 * through to that task. Data via /opportunities/{id}/tasks (C-42); four UI states.
 */
export default function TasksTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const { items, loading, error, reload } = useOpportunityTasks(o?.id)
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<'open' | 'history'>('open')

  const visible = items.filter(x => (view === 'open' ? !x.completed_at : !!x.completed_at))

  // Sub-view chips + the add button — same soft convention as the candidate tasks.
  const chip = (id: 'open' | 'history', label: string) => (
    <button key={id} onClick={() => setView(id)}
      style={{ padding: '2px 9px', fontSize: 10, fontWeight: view === id ? 600 : 500, borderRadius: 99, cursor: 'pointer',
        color: 'var(--color-primary)', border: `1px solid color-mix(in srgb, var(--color-primary) ${view === id ? 50 : 28}%, transparent)`,
        background: `color-mix(in srgb, var(--color-primary) ${view === id ? 16 : 8}%, transparent)` }}>
      {label}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
        {chip('open', t('tasks.open'))}
        {chip('history', t('tasks.history'))}
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Plus size={11} /> {t('tasks.newTask')}
        </button>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('tasks.loading')}</div>}
      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={14} /> {t('tasks.error')}
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
          <ListChecks size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 12 }}>{t('tasks.empty')}</span>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((task, i) => {
            // The API sends `status` as a lookup OBJECT ({value,label,color}); older
            // payloads sent a bare string — resolve both, never render the object raw.
            const st = task.status as { label?: string; value?: string; color?: string } | string | null | undefined
            const statusLabel = task.status_label ?? (typeof st === 'object' ? st?.label ?? st?.value : st)
            const color = task.status_color || (typeof st === 'object' ? st?.color : null) || '#9CA3AF'
            const due = (task.completed_at ?? task.due_at ?? task.due_date) as string | null | undefined
            return (
              <button key={task.id ?? i} onClick={() => task.id != null && openEntity('tasks', task.id)} title={t('tasks.openTask')}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px',
                  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>
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
              </button>
            )
          })}
        </div>
      )}

      {/* New task pre-linked to this opportunity; reload so the fresh row shows at once. */}
      {adding && o?.id != null && (
        <AddTaskModal
          extraLinks={[{ type: 'opportunity', id: String(o.id) }]}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); reload() }}
        />
      )}
    </div>
  )
}
