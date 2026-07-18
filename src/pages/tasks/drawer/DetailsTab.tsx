import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { Field, SelectField, DateField, TextField } from '@/components/forms/fields'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'
import { useUsers } from '@/lib/queries'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { isTaskOverdue, dueDateTime } from '../data/mapTask'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'
import type { CSSProperties, ReactNode } from 'react'

interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string; avatar_color?: string | null }

// Display name for a user record (tolerant of the various shapes /users returns).
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// One read-mode row: muted label left, value right.
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}

/**
 * DetailsTab — the task's core fields, read by default with an in-place edit
 * (pencil → diskette/✕). Lookups (type/status/priority) and the assignee come from
 * the tenant lookup + /users; nothing is hardcoded. Owner is always read-only.
 */
export default function DetailsTab({ task, onUpdate }: { task: TaskDetail; onUpdate: (patch: Record<string, unknown>) => void }) {
  const { t } = useTranslation('tasks')
  const { formatDate, formatDateTime } = useDateFormat()
  const { statuses, types, priorities } = useTaskLookups()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [descExpanded, setDescExpanded] = useState(false)

  // Enter edit mode with a draft seeded from the current values.
  const startEdit = () => {
    setDraft({ typeKey: task.typeKey, statusKey: task.statusKey, priorityKey: task.priorityKey,
      due: task.due || '', dueTime: task.dueTime || '', assigneeId: task.assigneeId ?? '', description: task.description ?? '' })
    setEditing(true)
  }
  const setD = (k: string, v: unknown) => setDraft(d => ({ ...d, [k]: v }))

  // Persist: build the patch (incl. a rebuilt assignee object for the optimistic UI).
  const save = () => {
    const sel = users.find(u => String(u.id) === String(draft.assigneeId))
    const assignee = sel ? { name: userName(sel), initials: initialsOf(userName(sel)), color: sel.avatar_color ?? null } : null
    onUpdate({ typeKey: draft.typeKey, statusKey: draft.statusKey, priorityKey: draft.priorityKey,
      due: draft.due || '', dueTime: draft.dueTime || '', description: draft.description,
      assigneeId: draft.assigneeId || null, assignee })
    setEditing(false)
  }

  // Label only — `icon` holds a lucide NAME, never prefix it as text (2026-07-08).
  const opts = (list: TaskLookupItem[]) => list.map(i => ({ value: i.value, label: i.label }))
  const assigneeOpts = [{ value: '', label: t('bureau') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]

  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

  return (
    <div>
      {/* Header with the edit toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('details.title')}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={t('comments.send')} aria-label={t('comments.send')}
              style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
            <button onClick={() => setEditing(false)} title={t('modal.cancel')} aria-label={t('modal.cancel')}
              style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : !task.archived && (
          // No edit on an ARCHIVED task. W2 delivered (measured: TaskController::update
          // is now withTrashed, so the PATCH no longer 404s) — the gating stays anyway:
          // restore first is a deliberate product choice (mirrors the header gating).
          <button onClick={startEdit} title={t('details.title')} aria-label={t('details.title')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <Edit2 size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('details.type')}><SelectField value={draft.typeKey as string} onChange={v => setD('typeKey', v)} options={opts(types)} /></Field>
          <Field label={t('details.status')}><SelectField value={draft.statusKey as string} onChange={v => setD('statusKey', v)} options={opts(statuses)} /></Field>
          <Field label={t('details.priority')}><SelectField value={draft.priorityKey as string} onChange={v => setD('priorityKey', v)} options={opts(priorities)} /></Field>
          {/* TASK-DUE-TIME-1: date + optional time-of-day, paired half-row. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('details.due')}><DateField value={draft.due as string} onChange={v => setD('due', v)} /></Field>
            <Field label={t('details.dueTime')}><TextField type="time" value={draft.dueTime as string} onChange={v => setD('dueTime', v)} /></Field>
          </div>
          <Field label={t('details.assignee')}><SelectField value={String(draft.assigneeId)} onChange={v => setD('assigneeId', v)} options={assigneeOpts} /></Field>
          {/* Description = the note body — same rich editor as the candidate profile text. */}
          <Field label={t('details.description')}>
            <RichTextEditor value={draft.description as string} onChange={v => setD('description', v)}
              expanded={descExpanded} onToggleExpand={() => setDescExpanded(e => !e)} />
          </Field>
        </div>
      ) : (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <Row label={t('details.type')}>{task.typeLabel ? <SoftChip label={task.typeLabel} color={task.typeColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
          <Row label={t('details.status')}>{task.statusLabel ? <SoftChip label={task.statusLabel} color={task.statusColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
          <Row label={t('details.priority')}>{task.priorityLabel ? <SoftChip label={task.priorityLabel} color={task.priorityColor} dot /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
          <Row label={t('details.due')}>
            <span style={{ fontSize: 12, color: task.due ? (isTaskOverdue(task) ? 'var(--color-danger)' : 'var(--text)') : 'var(--text-muted)', fontWeight: isTaskOverdue(task) ? 600 : 400 }}>
              {/* TASK-DUE-TIME-1: DD-MM-YYYY HH:mm when a time is set, date-only otherwise. */}
              {task.due ? (task.dueTime ? formatDateTime(dueDateTime(task.due, task.dueTime)) : formatDate(task.due)) : '—'}
            </span>
          </Row>
          <Row label={t('details.assignee')}>
            {task.assignee ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar initials={task.assignee.initials} size={20} color={task.assignee.color} />
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{task.assignee.name}</span>
              </span>
            ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('bureau')}</span>}
          </Row>
          <Row label={t('details.owner')}><span style={{ fontSize: 12, color: 'var(--text)' }}>{task.owner?.name || '—'}</span></Row>
          <div style={{ padding: '9px 12px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('details.description')}</span>
            {task.description
              ? <SafeHtml html={task.description} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
          </div>
        </div>
      )}
    </div>
  )
}
