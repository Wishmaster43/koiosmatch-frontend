/**
 * SubtasksSection — SUBTASK-1 (BE confirmed 14-08): subtasks already existed and
 * now ride the contract as `parent` (the main task) + `subtask_progress` on every
 * task. The tasks list HIDES subtasks by default, so this section fetches them
 * explicitly with `?parent_id=<id>` — the one documented way to see them. Renders
 * up to three things: (a) an "add subtask" affordance (always, DrawerAddButton —
 * §3A house pattern, never coloured text), (b) this task's OWN subtasks, when
 * `task.subtaskProgress.total > 0`, and (c) a reference row to the MAIN task,
 * when this task itself is a subtask (`task.parent` set).
 *
 * SUBTASK-CREATE-1 (14-08, this delivery): the add button opens AddTaskModal
 * with `parentId={task.id}` — POST /tasks does accept `parent_id` (confirmed in
 * the generated spec) and the modal now sends it whenever it is set, with NO
 * main-task picker added to the general form (brief rule 4: programmatic only).
 * The full create form is reused as-is (rule 2: "hergebruik waar dat kan" — every
 * required field, e.g. type, still applies; nothing here invents a default the
 * user doesn't see). After a successful create: the subtask list refetches, and
 * `onSubtaskCreated` bumps this task's own `subtaskProgress.total` — a LOCAL-only
 * count update (no PATCH — subtask_progress is a derived, read-only tally, never
 * a task field the API would accept a write for).
 *
 * TAKEN 3 (walkthrough 21-08, Danny: "eigen compacte pop-up"): a subtask ROW no
 * longer opens the full TaskDrawer — it opens the compact SubtaskQuickView
 * instead. The PARENT reference row keeps opening the full drawer (a parent is a
 * main task, not a subtask, and deserves its full context).
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, ArrowUpRight } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import SoftChip from '@/components/ui/SoftChip'
import { GroupLabel, Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import AddTaskModal from '../AddTaskModal'
import SubtaskQuickView from './SubtaskQuickView'
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

// Renders a task's subtask list (with a per-row quick view) and owns the
// freshness-guarded fetch that backs it.
export default function SubtasksSection({ task, onSubtaskCreated }: {
  task: TaskDetail
  // Local-only tally bump on the HOST task's own `subtaskProgress` (see file
  // header) — optional so tests/callers that never create a subtask stay unchanged.
  onSubtaskCreated?: () => void
}) {
  const { t } = useTranslation('tasks')
  const { openEntity } = useNavigation()
  const [rows, setRows] = useState<SubtaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // TAKEN 3: which subtask's compact quick view is open (null = none). A row
  // click sets this instead of navigating — the full drawer stays reserved for
  // the parent-reference row and the quick view's own "open as task" escape hatch.
  const [quickViewId, setQuickViewId] = useState<Id | null>(null)
  // Freshness guard (§9, mirrors RelatedTasks): a monotonic request id so a slow
  // response for a previously-opened task can never overwrite the current one.
  const requestIdRef = useRef(0)

  const hasSubtasks = Boolean(task.subtaskProgress && task.subtaskProgress.total > 0)

  // Loads this task's subtasks (skipped entirely when the progress tally says
  // there are none); the request-id guard drops a slow response for a task the
  // drawer has already moved past.
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

  // SUBTASK-CREATE-1: a fresh subtask was created — refetch this task's own list
  // (picks it up even on the very first subtask, since `hasSubtasks` flipping
  // true on its own re-triggers the effect above, but a SECOND add on an
  // already-nonzero total would not) and bump the host's local tally.
  const handleCreated = () => {
    setAddOpen(false)
    fetchSubtasks()
    onSubtaskCreated?.()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* SUBTASK-CREATE-1: the one "+ add" affordance, house pattern (§3A —
          DrawerAddButton, never coloured text). Always available, even before this
          task has any subtasks yet — that is precisely how the first one gets made. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DrawerAddButton onClick={() => setAddOpen(true)} label={t('details.subtasks.add')} />
      </div>

      {addOpen && (
        <AddTaskModal parentId={task.id} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      )}

      {/* This task's own main task — a plain reference row, read-only. */}
      {task.parent && (
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width clickable reference row (structural, not an action button)
        <button onClick={() => openEntity('tasks', task.parent!.id)} style={rowBtnStyle}>
          <ArrowUpRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <Caption as="span" style={{ flexShrink: 0 }}>{t('details.subtasks.parentLabel')}</Caption>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.parent.title || '—'}
          </span>
        </button>
      )}

      {/* This task's own subtasks, fetched with ?parent_id=. Four UI states (§3). */}
      {hasSubtasks && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{t('details.subtasks.title')}</GroupLabel>
            {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- mono progress counter (JetBrains Mono per §1), not a Caption/label copy */}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {task.subtaskProgress!.done}/{task.subtaskProgress!.total}
            </span>
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('details.subtasks.loading')}</div>
          ) : error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger-text)' }}>
              <span>{t('details.subtasks.error')}</span>
              <Button variant="secondary" size="sm" onClick={fetchSubtasks}>{t('common:error.retry')}</Button>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('details.subtasks.empty')}</div>
          ) : rows.map(r => {
            const st = r.status
            const label = typeof st === 'object' ? st?.label : st
            const color = (typeof st === 'object' ? st?.color : null) ?? 'var(--text-muted)'
            return (
              // TAKEN 3: a subtask row opens the compact quick view, never the full
              // drawer (that is the parent-reference row's job, above).
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width clickable reference row (structural, not an action button)
              <button key={String(r.id)} onClick={() => setQuickViewId(r.id)} style={rowBtnStyle}>
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

      {/* TAKEN 3: the compact quick view — status is editable there and persists
          immediately, so closing it must refetch this list (mirrors fetchSubtasks
          already used as the retry handler above). */}
      {quickViewId != null && (
        <SubtaskQuickView id={quickViewId} onClose={() => setQuickViewId(null)} onChanged={fetchSubtasks} />
      )}
    </div>
  )
}
