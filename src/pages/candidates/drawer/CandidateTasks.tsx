/**
 * CandidateTasks — the candidate's open tasks as a Communicatie sub-tab (Danny
 * 2026-07-03: "door wie, wanneer gemaakt, prio ect alles"). Each row shows title,
 * status + priority chips, due date, assignee and the created-by/at line; clicking
 * a row jumps to the Taken page (open intent) and "+ Taak" creates a task that is
 * pre-linked to this candidate. Data via GET /tasks?candidate={id} (TASKS-1).
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, Plus } from 'lucide-react'
import api from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import AddTaskModal from '@/pages/tasks/AddTaskModal'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

// One task row as the API returns it — lookup fields arrive as objects or bare slugs.
interface TaskRow {
  id: Id; title?: string; due_date?: string | null; completed_at?: string | null; created_at?: string | null
  priority?: { value?: string; label?: string; color?: string } | string | null
  status?: { value?: string; label?: string; color?: string } | string | null
  assignee?: { id?: Id; name?: string } | string | null
  created_by?: { id?: Id; name?: string } | string | null
}

// Resolve a person field ("by whom / for whom") from either API shape.
const personName = (v: TaskRow['assignee']): string => (typeof v === 'object' ? v?.name : v) ?? ''

export default function CandidateTasks({ candidateId }: { candidateId: Id }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(false)

  // Load the candidate-linked tasks; a 404/422 (param not built yet) reads as empty, not broken.
  const load = useCallback(() => {
    setLoading(true); setError(false)
    api.get('/tasks', { params: { candidate: candidateId } })
      .then(r => setTasks(((r.data?.data ?? r.data ?? []) as TaskRow[]).filter(x => !x.completed_at)))
      .catch(e => { if ([404, 422].includes(e?.response?.status)) setTasks([]); else setError(true) })
      .finally(() => setLoading(false))
  }, [candidateId])
  useEffect(() => { load() }, [load])

  // Priority/status chips arrive as lookup objects or bare strings — render defensively.
  const chip = (v: TaskRow['priority']) => {
    const label = typeof v === 'object' ? v?.label ?? v?.value : v
    const color = (typeof v === 'object' ? v?.color : null) ?? 'var(--text-muted)'
    if (!label) return null
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, color, whiteSpace: 'nowrap',
      background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}>{label}</span>
  }

  // "+ Taak" in the card header — opens the shared task modal pre-linked to this candidate.
  const addAction = (
    <button onClick={() => setAdding(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
      <Plus size={11} /> {t('drawer.newTask')}
    </button>
  )

  return (
    <SectionCard title={t('drawer.tasksTitle')} action={addAction}>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.tasksLoading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.tasksError')}</div>}
      {!loading && !error && tasks.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <ListChecks size={14} style={{ opacity: 0.6 }} /> {t('drawer.tasksEmpty')}
        </div>
      )}
      {!loading && !error && tasks.map(task => {
        const assignee = personName(task.assignee)
        const creator  = personName(task.created_by)
        // Created line: "aangemaakt door X · date" — parts render only when the API delivers them.
        const createdLine = [
          creator ? t('drawer.taskCreatedBy', { name: creator }) : null,
          task.created_at ? formatDate(task.created_at) : null,
        ].filter(Boolean).join(' · ')
        return (
          <button key={task.id} onClick={() => openEntity('tasks', task.id)} title={t('drawer.taskOpen')}
            style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 6,
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <ListChecks size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.title ?? '—'}
              </span>
              {task.due_date && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(task.due_date)}</span>}
              {chip(task.status)}
              {chip(task.priority)}
            </span>
            {/* Meta line: for whom (assignee) + created by/at — the "alles" Danny asked for. */}
            {(assignee || createdLine) && (
              <span style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-muted)', paddingLeft: 21, flexWrap: 'wrap' }}>
                {assignee && <span>{t('drawer.taskFor', { name: assignee })}</span>}
                {assignee && createdLine && <span>·</span>}
                {createdLine && <span>{createdLine}</span>}
              </span>
            )}
          </button>
        )
      })}
      {/* New task, pre-linked to this candidate; reload so the fresh row shows at once. */}
      {adding && (
        <AddTaskModal
          initial={{ candidateId: String(candidateId) }}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); load() }}
        />
      )}
    </SectionCard>
  )
}
