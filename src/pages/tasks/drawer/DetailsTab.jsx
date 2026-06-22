import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { Field, SelectField, DateField, TextArea } from '../../../components/forms/fields'
import Avatar from '../../../components/ui/Avatar'
import StatusPill from '../../../components/ui/StatusPill'
import { useTaskLookups } from '../../../context/TaskLookupsContext'
import { useUsers } from '../../../lib/queries'
import { useDateFormat } from '../../../lib/datetime'

// Display name for a user record (tolerant of the various shapes /users returns).
const userName = (u) => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'
const initialsOf = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const isOverdue = (task) => task.due && !task.statusIsDone && new Date(task.due) < new Date(new Date().toDateString())

// One read-mode row: muted label left, value right.
function Row({ label, children }) {
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
export default function DetailsTab({ task, onUpdate }) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const { statuses, types, priorities } = useTaskLookups()
  const { data: users = [] } = useUsers()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})

  // Enter edit mode with a draft seeded from the current values.
  const startEdit = () => {
    setDraft({ typeKey: task.typeKey, statusKey: task.statusKey, priorityKey: task.priorityKey,
      due: task.due || '', assigneeId: task.assigneeId ?? '', description: task.description ?? '' })
    setEditing(true)
  }
  const setD = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  // Persist: build the patch (incl. a rebuilt assignee object for the optimistic UI).
  const save = () => {
    const sel = users.find(u => String(u.id) === String(draft.assigneeId))
    const assignee = sel ? { name: userName(sel), initials: initialsOf(userName(sel)), color: sel.avatar_color ?? null } : null
    onUpdate({ typeKey: draft.typeKey, statusKey: draft.statusKey, priorityKey: draft.priorityKey,
      due: draft.due || '', description: draft.description, assigneeId: draft.assigneeId || null, assignee })
    setEditing(false)
  }

  const opts = (list) => list.map(i => ({ value: i.value, label: i.label }))
  const assigneeOpts = [{ value: '', label: t('bureau') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]

  const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

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
        ) : (
          <button onClick={startEdit} title={t('details.title')} aria-label={t('details.title')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <Edit2 size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('details.type')}><SelectField value={draft.typeKey} onChange={v => setD('typeKey', v)} options={opts(types)} /></Field>
          <Field label={t('details.status')}><SelectField value={draft.statusKey} onChange={v => setD('statusKey', v)} options={opts(statuses)} /></Field>
          <Field label={t('details.priority')}><SelectField value={draft.priorityKey} onChange={v => setD('priorityKey', v)} options={opts(priorities)} /></Field>
          <Field label={t('details.due')}><DateField value={draft.due} onChange={v => setD('due', v)} /></Field>
          <Field label={t('details.assignee')}><SelectField value={String(draft.assigneeId)} onChange={v => setD('assigneeId', v)} options={assigneeOpts} /></Field>
          <Field label={t('details.description')}><TextArea value={draft.description} onChange={v => setD('description', v)} rows={4} /></Field>
        </div>
      ) : (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <Row label={t('details.type')}>{task.typeLabel ? <StatusPill label={task.typeLabel} color={task.typeColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
          <Row label={t('details.status')}>{task.statusLabel ? <StatusPill label={task.statusLabel} color={task.statusColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
          <Row label={t('details.priority')}>{task.priorityLabel ? <StatusPill label={task.priorityLabel} color={task.priorityColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
          <Row label={t('details.due')}>
            <span style={{ fontSize: 12, color: task.due ? (isOverdue(task) ? 'var(--color-danger)' : 'var(--text)') : 'var(--text-muted)', fontWeight: isOverdue(task) ? 600 : 400 }}>
              {task.due ? formatDate(task.due) : '—'}
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
            <span style={{ fontSize: 12, color: task.description ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{task.description || '—'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
