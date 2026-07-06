/**
 * RelatedTasks — inside the TASK drawer: the other tasks of the linked candidate,
 * split Open / Historie (Danny 2026-07-06: "je opent een taak en ziet niet de
 * historie van afgesloten taken"). Rows click through to that task's drawer via
 * the open-intent. Renders nothing when the task has no candidate link.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import api from '@/lib/api'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface Row {
  id: Id; title?: string; due_date?: string | null; completed_at?: string | null
  status?: { label?: string; color?: string } | string | null
}

export default function RelatedTasks({ task }: { task: TaskDetail }) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const [rows, setRows] = useState<Row[]>([])
  const [view, setView] = useState<'open' | 'history'>('open')

  const candidateId = (task.links ?? []).find(l => l.type === 'candidate')?.id ?? null

  // Load the candidate's tasks; own task filtered out. Missing param reads as empty.
  useEffect(() => {
    if (!candidateId) { setRows([]); return }
    let alive = true
    api.get('/tasks', { params: { candidate: candidateId } })
      .then(r => { if (alive) setRows(((r.data?.data ?? r.data ?? []) as Row[]).filter(x => String(x.id) !== String(task.id))) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [candidateId, task.id])

  if (!candidateId) return null
  const visible = rows.filter(x => (view === 'open' ? !x.completed_at : !!x.completed_at))

  const chip = (id: 'open' | 'history', label: string) => (
    <button key={id} onClick={() => setView(id)}
      style={{ padding: '2px 9px', fontSize: 10, fontWeight: view === id ? 600 : 500, borderRadius: 99, cursor: 'pointer',
        color: 'var(--color-primary)', border: `1px solid color-mix(in srgb, var(--color-primary) ${view === id ? 50 : 28}%, transparent)`,
        background: `color-mix(in srgb, var(--color-primary) ${view === id ? 16 : 8}%, transparent)` }}>
      {label}
    </button>
  )

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('related.title')}</span>
        <span style={{ display: 'flex', gap: 6 }}>{chip('open', t('related.open'))}{chip('history', t('related.history'))}</span>
      </div>
      {visible.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('related.empty')}</div>
      ) : visible.map(r => {
        const st = r.status
        const label = typeof st === 'object' ? st?.label : st
        const color = (typeof st === 'object' ? st?.color : null) ?? 'var(--text-muted)'
        return (
          <button key={String(r.id)} onClick={() => openEntity('tasks', r.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 6,
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: 'pointer' }}>
            <ListChecks size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.title ?? '—'}
            </span>
            {(r.completed_at || r.due_date) && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(r.completed_at ?? r.due_date ?? undefined)}</span>
            )}
            {label && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, color, whiteSpace: 'nowrap',
              background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
