import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Edit2, Save, X } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import type { MetaPicker } from '@/components/drawer/EntityHeader'
import TitleBadge from '@/components/drawer/TitleBadge'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useUsers } from '@/lib/queries'
import DetailsTab from './drawer/DetailsTab'
import RelatedTasks, { hasRelatedSubject } from './drawer/RelatedTasks'
import LinksTab from './drawer/LinksTab'
import NotesTab from './drawer/NotesTab'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ActivityTab from './drawer/ActivityTab'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import TrashLifecycleSection from '@/components/drawer/TrashLifecycleSection'
import type { TrashSectionConfig } from '@/components/drawer/TrashLifecycleSection'
import { initialsOf } from '@/lib/initials'
import { BTN_H } from '@/config/buttonMetrics'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

interface NewLink { type: string; id: string; label: string }
interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string; avatar_color?: string | null }
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// The tab order. The changelog is a header popover (not a tab), mirroring candidate.
// NT-TASK-1 (Danny, reinstated): the old plain "Reacties" thread removed 2026-07-14
// returns as a proper type-aware NOTES tab (mirrors matches' NotesTab onto the same
// shared NotesTab family) instead of the empty comments stub.
// T5: "related" (the other tasks of whichever record this task is linked to) is its
// own tab now — was a section pinned under Details, generalised beyond candidate-only.
// 'extra' (§3A(f)) is appended below only when the tenant has ≥1 active custom field.
const TAB_IDS = ['details', 'links', 'related', 'notes']

const hdrBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0 }
const hdrGhost: CSSProperties = { ...hdrBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
const hdrPrimary: CSSProperties = { ...hdrBtn, background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }

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
  // TRASH-OVERAL-2: the shared trash-section wiring (mark/unmark, see TrashLifecycleSection).
  trash?: TrashSectionConfig
  // SUBTASK-CREATE-1: local-only `subtaskProgress` tally bump after a subtask is
  // created in DetailsTab's SubtasksSection — see TaskDrawer's own render below.
  onSubtaskCreated?: (id: Id | undefined) => void
}

/**
 * TaskDrawer — thin container: declares the header config + tab list and wires them
 * to the shared EntityDrawer shell. The header carries the primary meta pickers
 * (status / priority / assignee) + a one-click "mark done" quick action, so the most
 * common changes need no edit-mode; the full field edit still lives in DetailsTab.
 */
export default function TaskDrawer({ task, onClose, expanded, onToggleExpand, onUpdate, onAddLink, onRemoveLink, onRestore, trash, onSubtaskCreated }: TaskDrawerProps) {
  const { t } = useTranslation('tasks')
  const { formatDate, formatDateTime } = useDateFormat()
  const { statuses, priorities, doneStatusValues } = useTaskLookups()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  // The Extra tab only shows when the tenant has defined task custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('task')
  // T1: inline title edit — mirror VacancyDrawer's V7 idiom (pencil → input →
  // save/cancel). Reset whenever a different task is opened (adjust-during-render,
  // same pattern as VacancyDrawer) — belt-and-braces since the page also keys the
  // whole drawer on task.id, remounting this component on every reselect.
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [prevId, setPrevId] = useState<Id | undefined>(task?.id)
  if (task?.id !== prevId) { setPrevId(task?.id); setEditingTitle(false); setTitleDraft('') }
  if (!task) return null

  const startTitleEdit = () => { setTitleDraft(task.title); setEditingTitle(true) }
  const saveTitleEdit = () => { const val = titleDraft.trim(); if (val && val !== task.title) onUpdate(task.id, { title: val }); setEditingTitle(false) }

  // Map a tab id to its content component.
  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'details':  return <DetailsTab task={task} onUpdate={patch => onUpdate(task.id, patch)} onSubtaskCreated={() => onSubtaskCreated?.(task.id)} />
      case 'links':    return <LinksTab task={task} onAddLink={link => onAddLink(task.id, link)} onRemoveLink={link => onRemoveLink(task.id, link)} />
      // T5: its own tab now (generalised beyond candidate-only) — was a section
      // pinned under Details.
      case 'related':  return <RelatedTasks task={task} />
      case 'notes':    return <NotesTab task={task} />
      case 'extra':    return <CustomFieldsTab entityType="task" values={task.customFields ?? {}}
                          onSave={patch => onUpdate(task.id, { customFields: { ...task.customFields, ...patch } })} />
      default:         return null
    }
  }
  // FIX 2 (esc-en-lege-tabs, "no empty tabs" — §3A): "related" renders nothing (no
  // list, no add-affordance — it is read-only) when the task carries no qualifying
  // link and no assignee, so it only joins the tab bar once it has a real subject.
  const tabIds = TAB_IDS
    .filter(id => id !== 'related' || hasRelatedSubject(task))
    .concat(customFieldDefs.length > 0 ? ['extra'] : [])

  // Assignee options: "Bureau" (unassigned) + every user. Picking rebuilds the
  // assignee object so the optimistic UI shows the name/initials immediately.
  const assigneeOpts = [{ value: '', label: t('bureau') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]
  const onAssignee = (v: string) => {
    const sel = users.find(u => String(u.id) === String(v))
    const assignee = sel ? { name: userName(sel), initials: initialsOf(userName(sel)), color: sel.avatar_color ?? null } : null
    onUpdate(task.id, { assigneeId: v || null, assignee })
  }

  // Header meta pickers: quick status / priority / assignee change (no edit-mode).
  // ARCHIVED: no pickers on an inactive record. W2 delivered (measured):
  // TaskController::update is now Task::withTrashed()->findOrFail, so the PATCH no
  // longer 404s on a soft-deleted task — but the gating stays: editing an archived
  // record is a deliberate product choice (restore first), not a technical necessity
  // anymore. Keep it hidden.
  // Standard picker widths (§3A blueprint: Status ~160 + Eigenaar/assignee ~190;
  // priority stays 140 — already conforms).
  const meta: MetaPicker[] = task.archived ? [] : [
    { key: 'status',   label: t('details.status'),   value: String(task.statusKey),        options: statuses.map(s => ({ value: s.value, label: s.label })),   onChange: v => onUpdate(task.id, { statusKey: v }),   menuWidth: 170, width: 160 },
    { key: 'priority', label: t('details.priority'), value: String(task.priorityKey),      options: priorities.map(p => ({ value: p.value, label: p.label })), onChange: v => onUpdate(task.id, { priorityKey: v }), menuWidth: 150, width: 140 },
    { key: 'assignee', label: t('details.assignee'), value: String(task.assigneeId ?? ''), options: assigneeOpts,                                              onChange: onAssignee,                                menuWidth: 200, width: 190 },
  ]

  // "Mark done" quick action — only when a done status exists and the task isn't
  // done; never on an archived task (same product-choice gating as the pickers above).
  const doneValue = doneStatusValues[0]
  const markDone = doneValue != null && !task.statusIsDone && !task.archived
    ? (
      // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
      <button onClick={() => onUpdate(task.id, { statusKey: doneValue })}
        style={{ display: 'flex', alignItems: 'center', gap: 5, height: BTN_H, padding: '0 10px', fontSize: 11, fontWeight: 600,
          borderRadius: 7, cursor: 'pointer', border: '1px solid var(--color-success)', background: 'var(--color-success)', color: 'var(--color-on-success)' }}>
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
          renderTitle={() => editingTitle ? (
            // T1: inline title edit — mirror VacancyDrawer's renderTitle swap.
            <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitleEdit(); if (e.key === 'Escape') setEditingTitle(false) }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 15, fontWeight: 700,
                borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text)' }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{task.title}</span>
                {/* NUMMER-3: the copy chip, right after the title and before the status badge (§3A). */}
                <ReferenceNumberChip value={task.referenceNumber} />
                {/* Status badge — colour-coded, read-only (mirrors the candidate phase badge,
                    §3A(c)); the status meta picker below still handles the actual change. */}
                <TitleBadge label={task.statusLabel} color={task.statusColor} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.typeLabel || '—'}</div>
            </>
          )}
          // Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — was a
          // cramped 360px dropdown with no focus trap; now the same 900px centred
          // panel as the candidate drawer. ActivityTab supplies the task's own content.
          titleActions={<ChangelogPopover><ActivityTab task={task} /></ChangelogPopover>}
          // T1: title pencil → save/cancel, same spot as VacancyDrawer; "mark done"
          // rides alongside it. No pencil on an ARCHIVED task (mirrors every other
          // edit affordance in this drawer — restore first, a deliberate product
          // choice per the meta-picker comment below, not a technical necessity).
          actions={editingTitle ? (
            <>
              <button onClick={saveTitleEdit} title={t('common:save')} style={hdrPrimary}><Save size={14} /></button>
              <button onClick={() => setEditingTitle(false)} title={t('common:cancel')} style={hdrGhost}><X size={14} /></button>
            </>
          ) : (
            <>
              {!task.archived && <button onClick={startTitleEdit} title={t('common:edit')} style={hdrGhost}><Edit2 size={13} /></button>}
              {markDone}
            </>
          )}
          meta={meta}
          // Tag editing is a PATCH too — hidden while archived (same gating, see meta above).
          tags={task.archived ? undefined : {
            items: task.tags ?? [],
            onAdd: (tag: string) => onUpdate(task.id, { tags: [...(task.tags ?? []), tag] }),
            onRemove: (tag: string) => onUpdate(task.id, { tags: (task.tags ?? []).filter(x => x !== tag) }),
            addLabel: t('drawer.tags'),
          }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Enkelstuks-sweep: archived state + per-id restore via the ONE shared
              ArchivedBanner (§3A — extend, never duplicate). W2 delivered (measured:
              TaskListResource now carries deleted_at) → shows "Archived on {date}";
              falls back to the flag-only line only if a row somehow has none. */}
          {/* TRASH-OVERAL-2: hidden once the record sits in the trash — the trash
              banner (TrashLifecycleSection) takes over with unmark instead. */}
          {task.archived && task.lifecycle !== 'pending_erase' && (
            <ArchivedBanner id={task.id} onRestore={onRestore}
              message={task.archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(task.archivedAt) }) : t('drawer.archivedBanner.flag')}
              restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
          {/* TRASH-OVERAL-2: the shared mark/unmark surface (permission-gated in `trash`). */}
          {trash && (
            <TrashLifecycleSection entityPath="tasks" id={task.id} entityLabel={task.title}
              lifecycle={task.lifecycle} pendingEraseAt={task.pendingEraseAt} {...trash} />
          )}
        </EntityHeader>
      )}
    />
  )
}
