import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import type { MetaPicker } from '@/components/drawer/EntityHeader'
import { useDateFormat } from '@/lib/datetime'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useUsers } from '@/lib/queries'
import DetailsTab from './drawer/DetailsTab'
import LinksTab from './drawer/LinksTab'
import CommentsTab from './drawer/CommentsTab'
import TaskChangelogPopover from './drawer/TaskChangelogPopover'
import { initialsOf } from '@/lib/initials'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface NewLink { type: string; id: string; label: string }
interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string; avatar_color?: string | null }
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// The tab order. The changelog is a header popover (not a tab), mirroring candidate.
const TAB_IDS = ['details', 'links', 'comments']

interface TaskDrawerProps {
  task: TaskDetail | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate: (id: Id | undefined, patch: Record<string, unknown>) => void
  onAddComment: (id: Id | undefined, body: string) => void
  onAddLink: (id: Id | undefined, link: NewLink) => void
  onRemoveLink: (id: Id | undefined, link: { type: string; id: Id | null }) => void
}

/**
 * TaskDrawer — thin container: declares the header config + tab list and wires them
 * to the shared EntityDrawer shell. The header carries the primary meta pickers
 * (status / priority / assignee) + a one-click "mark done" quick action, so the most
 * common changes need no edit-mode; the full field edit still lives in DetailsTab.
 */
export default function TaskDrawer({ task, onClose, expanded, onToggleExpand, onUpdate, onAddComment, onAddLink, onRemoveLink }: TaskDrawerProps) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const { statuses, priorities, doneStatusValues } = useTaskLookups()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  if (!task) return null

  // Map a tab id to its content component.
  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'details':  return <DetailsTab task={task} onUpdate={patch => onUpdate(task.id, patch)} />
      case 'links':    return <LinksTab task={task} onAddLink={link => onAddLink(task.id, link)} onRemoveLink={link => onRemoveLink(task.id, link)} />
      case 'comments': return <CommentsTab task={task} onAdd={body => onAddComment(task.id, body)} />
      default:         return null
    }
  }

  // Assignee options: "Bureau" (unassigned) + every user. Picking rebuilds the
  // assignee object so the optimistic UI shows the name/initials immediately.
  const assigneeOpts = [{ value: '', label: t('bureau') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]
  const onAssignee = (v: string) => {
    const sel = users.find(u => String(u.id) === String(v))
    const assignee = sel ? { name: userName(sel), initials: initialsOf(userName(sel)), color: sel.avatar_color ?? null } : null
    onUpdate(task.id, { assigneeId: v || null, assignee })
  }

  // Header meta pickers: quick status / priority / assignee change (no edit-mode).
  const meta: MetaPicker[] = [
    { key: 'status',   label: t('details.status'),   value: String(task.statusKey),        options: statuses.map(s => ({ value: s.value, label: s.label })),   onChange: v => onUpdate(task.id, { statusKey: v }),   menuWidth: 170, width: 150 },
    { key: 'priority', label: t('details.priority'), value: String(task.priorityKey),      options: priorities.map(p => ({ value: p.value, label: p.label })), onChange: v => onUpdate(task.id, { priorityKey: v }), menuWidth: 150, width: 140 },
    { key: 'assignee', label: t('details.assignee'), value: String(task.assigneeId ?? ''), options: assigneeOpts,                                              onChange: onAssignee,                                menuWidth: 200, width: 180 },
  ]

  // "Mark done" quick action — only when a done status exists and the task isn't done.
  const doneValue = doneStatusValues[0]
  const markDone = doneValue != null && !task.statusIsDone
    ? (
      <button onClick={() => onUpdate(task.id, { statusKey: doneValue })}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, fontWeight: 600,
          borderRadius: 7, cursor: 'pointer', border: '1px solid var(--color-success)', background: 'var(--color-success)', color: '#fff' }}>
        <CheckCircle2 size={12} /> {t('drawer.markDone')}
      </button>
    ) : null

  return (
    <EntityDrawer
      entity={task}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: task.createdAt ? formatDate(task.createdAt) : '—' })}</span>}
      tabs={TAB_IDS.map(id => ({ id, label: t(`drawer.tabs.${id}`), render: () => renderTab(id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.label')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: initialsOf(task.title, 'T'), soft: true, color: task.statusColor }}
          title={task.title}
          subtitle={task.typeLabel || ''}
          titleActions={<TaskChangelogPopover task={task} />}
          actions={markDone}
          meta={meta}
          tags={{
            items: task.tags ?? [],
            onAdd: (tag: string) => onUpdate(task.id, { tags: [...(task.tags ?? []), tag] }),
            onRemove: (tag: string) => onUpdate(task.id, { tags: (task.tags ?? []).filter(x => x !== tag) }),
            addLabel: t('drawer.tags'),
          }}
          tagsLabel={t('drawer.tags')}
        />
      )}
    />
  )
}
