/**
 * SubtasksSection — SUBTASK-1 (BE confirmed 14-08): subtasks already existed and
 * now ride the contract as `parent` (the main task) + `subtask_progress` on every
 * task. The tasks list HIDES subtasks by default, so this section fetches them
 * explicitly with `?parent_id=<id>` — the one documented way to see them. Renders
 * two independent things, either or both: (a) this task's OWN subtasks, when
 * `task.subtaskProgress.total > 0`; (b) a reference row to the MAIN task, when
 * this task itself is a subtask (`task.parent` set). Renders nothing when neither
 * applies (no fake affordance, §3).
 *
 * No "add subtask" button here (deliberately): POST /tasks does accept a
 * `parent_id`, but there is no dedicated create-with-parent flow in the UI yet
 * (AddTaskModal has no parent picker) — building that is out of this task's scope.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, ArrowUpRight } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import SoftChip from '@/components/ui/SoftChip'
import { sectionTitle } from '@/components/ui/SectionCard'
import { useNavigation } from '@/context/NavigationContext'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface SubtaskRow {
  id: Id
  title?: string
  status?: { label?: string; color?: string } | string | null
}

const rowBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' as const,
  padding: '7px 10px', marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--bg)', cursor: 'pointer',
}

export default function SubtasksSection({ task }: { task: TaskDetail }) {
  const { t } = useTranslation('tasks')
  const { openEntity } = useNavigation()
  const [rows, setRows] = useState<SubtaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  // Freshness guard (§9, mirrors RelatedTasks): a monotonic request id so a slow
  // response for a previously-opened task can never overwrite the current one.
  const requestIdRef = useRef(0)

  const hasSubtasks = Boolean(task.subtaskProgress && task.subtaskProgress.total > 0)

  const fetchSubtasks = useCallback(() => {
    if (!hasSubtasks) { setRows([]); setLoading(false); setError(false); return }
    const requestId = ++requestIdRef.current
    setLoading(true); setError(false)
    api.get('/tasks', { params: { parent_id: task.id } })
      .then(r => { if (requestIdRef.current === requestId) setRows(unwrapList(r).rows as SubtaskRow[]) })
      .catch(err => { if (requestIdRef.current === requestId && err?.response?.status !== 404) setError(true) })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false) })
  }, [hasSubtasks, task.id])
  useEffect(() => { fetchSubtasks() }, [fetchSubtasks])

  // Neither a parent task to link to nor own subtasks to list — render nothing.
  if (!hasSubtasks && !task.parent) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* This task's own main task — a plain reference row, read-only. */}
      {task.parent && (
        <button onClick={() => openEntity('tasks', task.parent!.id)} style={rowBtnStyle}>
          <ArrowUpRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{t('details.subtasks.parentLabel')}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.parent.title || '—'}
          </span>
        </button>
      )}

      {/* This task's own subtasks, fetched with ?parent_id=. Four UI states (§3). */}
      {hasSubtasks && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={sectionTitle}>{t('details.subtasks.title')}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {task.subtaskProgress!.done}/{task.subtaskProgress!.total}
            </span>
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('details.subtasks.loading')}</div>
          ) : error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger)' }}>
              <span>{t('details.subtasks.error')}</span>
              <button onClick={fetchSubtasks} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '3px 9px', cursor: 'pointer', color: 'var(--text)' }}>{t('common:error.retry')}</button>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('details.subtasks.empty')}</div>
          ) : rows.map(r => {
            const st = r.status
            const label = typeof st === 'object' ? st?.label : st
            const color = (typeof st === 'object' ? st?.color : null) ?? 'var(--text-muted)'
            return (
              <button key={String(r.id)} onClick={() => openEntity('tasks', r.id)} style={rowBtnStyle}>
                <ListChecks size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title ?? '—'}
                </span>
                {label && <SoftChip label={label} color={color} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
