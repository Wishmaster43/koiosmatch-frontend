/**
 * CandidateTasks — the candidate's open tasks inside the Communicatie tab (Danny 2026-07-03:
 * "Taken: 5, maar welke?"). Compact list: title · due date · priority chip. Data via
 * GET /tasks?candidate={id} (TASKS-1) — graceful empty until the backend ships the param.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import api from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

interface TaskRow {
  id: Id; title?: string; due_date?: string | null; completed_at?: string | null
  priority?: { value?: string; label?: string; color?: string } | string | null
  status?: { value?: string; label?: string; color?: string } | string | null
}

export default function CandidateTasks({ candidateId }: { candidateId: Id }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load the candidate-linked tasks; a 404/422 (param not built yet) reads as empty, not broken.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    api.get('/tasks', { params: { candidate: candidateId } })
      .then(r => { if (alive) setTasks(((r.data?.data ?? r.data ?? []) as TaskRow[]).filter(x => !x.completed_at)) })
      .catch(e => { if (alive) { if ([404, 422].includes(e?.response?.status)) setTasks([]); else setError(true) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [candidateId])

  // Priority/status chips arrive as lookup objects or bare strings — render defensively.
  const chip = (v: TaskRow['priority']) => {
    const label = typeof v === 'object' ? v?.label ?? v?.value : v
    const color = (typeof v === 'object' ? v?.color : null) ?? 'var(--text-muted)'
    if (!label) return null
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, color,
      background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}>{label}</span>
  }

  return (
    <SectionCard title={t('drawer.tasksTitle')}>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.tasksLoading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.tasksError')}</div>}
      {!loading && !error && tasks.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <ListChecks size={14} style={{ opacity: 0.6 }} /> {t('drawer.tasksEmpty')}
        </div>
      )}
      {!loading && !error && tasks.map(task => (
        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', marginBottom: 6,
          border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
          <ListChecks size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title ?? '—'}
          </span>
          {task.due_date && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(task.due_date)}</span>}
          {chip(task.priority)}
        </div>
      ))}
    </SectionCard>
  )
}
