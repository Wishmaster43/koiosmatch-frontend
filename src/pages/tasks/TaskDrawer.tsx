import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import type { MetaPicker } from '@/components/drawer/EntityHeader'
import TitleBadge from '@/components/drawer/TitleBadge'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useUsers } from '@/lib/queries'
import DetailsTab from './drawer/DetailsTab'
import RelatedTasks from './drawer/RelatedTasks'
import LinksTab from './drawer/LinksTab'
import TaskChangelogPopover from './drawer/TaskChangelogPopover'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import { initialsOf } from '@/lib/initials'
import { BTN_H } from '@/config/buttonMetrics'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface NewLink { type: string; id: string; label: string }
interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string; avatar_color?: string | null }
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// The tab order. The changelog is a header popover (not a tab), mirroring candidate.
// Reacties removed again (Danny 2026-07-14): the empty thread was clutter; task
// comments live on in the record notes API but get no tab until asked for.
// 'extra' (§3A(f)) is appended below only when the tenant has ≥1 active custom field.
const TAB_IDS = ['details', 'links']

interface TaskDrawerProps {
  task: TaskDetail | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate: (id: Id | undefined, patch: Record<string, unknown>) => void
  onAddLink: (id: Id | undefined, link: NewLink) => void
  onRemoveLink: (id: Id | undefined, link: { type: string; id: Id | null }) => void
  // Enkelstuks-sweep: per-id restore — the page passes this only with tasks.update.
  onRestore?: (id: Id | undefined) => void
}

/**
 * TaskDrawer — thin container: declares the header config + tab list and wires them
 * to the shared EntityDrawer shell. The header carries the primary meta pickers
 * (status / priority / assignee) + a one-click "mark done" quick action, so the most
 * common changes need no edit-mode; the full field edit still lives in DetailsTab.
 */
export default function TaskDrawer({ task, onClose, expanded, onToggleExpand, onUpdate, onAddLink, onRemoveLink, onRestore }: TaskDrawerProps) {
  const { t } = useTranslation('tasks')
  const { formatDate, formatDateTime } = useDateFormat()
  const { statuses, priorities, doneStatusValues } = useTaskLookups()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  // The Extra tab only shows when the tenant has defined task custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('task')
  if (!task) return null

  // Map a tab id to its content component.
  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'details':  return <><DetailsTab task={task} onUpdate={patch => onUpdate(task.id, patch)} /><RelatedTasks task={task} /></>
      case 'links':    return <LinksTab task={task} onAddLink={link => onAddLink(task.id, link)} onRemoveLink={link => onRemoveLink(task.id, link)} />
      case 'extra':    return <CustomFieldsTab entityType="task" values={task.customFields ?? {}}
                          onSave={patch => onUpdate(task.id, { customFields: { ...task.customFields, ...patch } })} />
      default:         return null
    }
  }
  const tabIds = customFieldDefs.length > 0 ? [...TAB_IDS, 'extra'] : TAB_IDS

  // Assignee options: "Bureau" (unassigned) + every user. Picking rebuilds the
  // assignee object so the optimistic UI shows the name/initials immediately.
  const assigneeOpts = [{ value: '', label: t('bureau') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]
  const onAssignee = (v: string) => {
    const sel = users.find(u => String(u.id) === String(v))
    const assignee = sel ? { name: userName(sel), initials: initialsOf(userName(sel)), color: sel.avatar_color ?? null } : null
    onUpdate(task.id, { assigneeId: v || null, assignee })
  }

  // Header meta pickers: quick status / priority / assignee change (no edit-mode).
  // ARCHIVED: no pickers on an inactive record — every task PATCH 404s while soft-
  // deleted (measured: TaskController::update findOrFail) — restore first (mirrors
  // the candidate drawer's archived gating).
  // Standard picker widths (§3A blueprint: Status ~160 + Eigenaar/assignee ~190;
  // priority stays 140 — already conforms).
  const meta: MetaPicker[] = task.archived ? [] : [
    { key: 'status',   label: t('details.status'),   value: String(task.statusKey),        options: statuses.map(s => ({ value: s.value, label: s.label })),   onChange: v => onUpdate(task.id, { statusKey: v }),   menuWidth: 170, width: 160 },
    { key: 'priority', label: t('details.priority'), value: String(task.priorityKey),      options: priorities.map(p => ({ value: p.value, label: p.label })), onChange: v => onUpdate(task.id, { priorityKey: v }), menuWidth: 150, width: 140 },
    { key: 'assignee', label: t('details.assignee'), value: String(task.assigneeId ?? ''), options: assigneeOpts,                                              onChange: onAssignee,                                menuWidth: 200, width: 190 },
  ]

  // "Mark done" quick action — only when a done status exists and the task isn't
  // done; never on an archived task (same 404 gating as the pickers above).
  const doneValue = doneStatusValues[0]
  const markDone = doneValue != null && !task.statusIsDone && !task.archived
    ? (
      // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
      <button onClick={() => onUpdate(task.id, { statusKey: doneValue })}
        style={{ display: 'flex', alignItems: 'center', gap: 5, height: BTN_H, padding: '0 10px', fontSize: 11, fontWeight: 600,
          borderRadius: 7, cursor: 'pointer', border: '1px solid var(--color-success)', background: 'var(--color-success)', color: '#fff' }}>
        <CheckCircle2 size={12} /> {t('drawer.markDone')}
      </button>
    ) : null

  return (
    <EntityDrawer
      entity={task}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Two-sided footer (§3A(8)): created-at left, empty right (consistent spacing
      // with the candidate/other drawers even when there is no right-side content).
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(task.createdAt) })}</span>
          <span />
        </div>
      }
      tabs={tabIds.map(id => ({ id, label: t(`drawer.tabs.${id}`), render: () => renderTab(id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.label')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: initialsOf(task.title, 'T'), soft: true, color: task.statusColor }}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{task.title}</span>
                {/* Status badge — colour-coded, read-only (mirrors the candidate phase badge,
                    §3A(c)); the status meta picker below still handles the actual change. */}
                <TitleBadge label={task.statusLabel} color={task.statusColor} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.typeLabel || '—'}</div>
            </>
          )}
          titleActions={<TaskChangelogPopover task={task} />}
          actions={markDone}
          meta={meta}
          // Tag editing is a PATCH too — hidden while archived (404s, see meta above).
          tags={task.archived ? undefined : {
            items: task.tags ?? [],
            onAdd: (tag: string) => onUpdate(task.id, { tags: [...(task.tags ?? []), tag] }),
            onRemove: (tag: string) => onUpdate(task.id, { tags: (task.tags ?? []).filter(x => x !== tag) }),
            addLabel: t('drawer.tags'),
          }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Enkelstuks-sweep: archived state + per-id restore via the ONE shared
              ArchivedBanner (§3A — extend, never duplicate). archivedAt is null today
              (measured: TaskListResource has no deleted_at) → flag-only line. */}
          {task.archived && (
            <ArchivedBanner id={task.id} onRestore={onRestore}
              message={task.archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(task.archivedAt) }) : t('drawer.archivedBanner.flag')}
              restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
        </EntityHeader>
      )}
    />
  )
}
