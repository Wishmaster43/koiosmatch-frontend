/**
 * TaskDrawer — thin container: declares the header config + tab list and wires them
 * to the shared EntityDrawer shell. The header carries the primary meta pickers
 * (status / priority / assignee) + a one-click "mark done" quick action, so the most
 * common changes need no edit-mode; the full field edit still lives in DetailsTab.
 */
import type { ReactNode } from 'react'
import { useState, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Edit2 } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import type { MetaPicker } from '@/components/drawer/EntityHeader'
import TitleBadge from '@/components/drawer/TitleBadge'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
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
import ChangelogTab from './drawer/ChangelogTab'
import TimelineTab from './drawer/TimelineTab'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { PlanIntakeModal } from '@/pages/candidates/shared'
import { EntityDrawerCreatedAtFooter } from '@/components/drawer/EntityDrawerCreatedAtFooter'
import { PageTitle } from '@/components/ui/typography'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import TrashLifecycleSection from '@/components/drawer/TrashLifecycleSection'
import type { TrashSectionConfig } from '@/components/drawer/TrashLifecycleSection'
import { initialsOf } from '@/lib/initials'
import Button from '@/components/ui/Button'
import TitleEditInput from '@/components/drawer/TitleEditInput'
import TitleEditActions from '@/components/drawer/TitleEditActions'
import { userName, type UserLike } from '@/lib/userDisplay'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'

interface NewLink { type: string; id: string; label: string }

// The tab order. The changelog is a header popover (not a tab), mirroring candidate.
// NT-TASK-1 (Danny, reinstated): the old plain "Reacties" thread removed 2026-07-14
// returns as a proper type-aware NOTES tab (mirrors matches' NotesTab onto the same
// shared NotesTab family) instead of the empty comments stub.
// T5: "related" (the other tasks of whichever record this task is linked to) is its
// own tab now — was a section pinned under Details, generalised beyond candidate-only.
// 'extra' (§3A(f)) is appended below only when the tenant has ≥1 active custom field.
// TIJDLIJN-OVERAL (27-08): 'timeline' mounts after notes, reusing the same
// ChangelogTab content the title-row popover shows. Tasks carry no Statistics
// tab (measured — not built in this wave), so timeline is the LAST tab here.
const TAB_IDS = ['details', 'links', 'related', 'notes', 'timeline']

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

// Thin drawer container: inline title edit, tab visibility (Extra/Related gating) and the tab-content dispatcher below; header meta reads the live tenant lookup at render (see the TAKEN-CHIP-KLEUR-BUG-1 note).
export default function TaskDrawer({ task, onClose, expanded, onToggleExpand, onUpdate, onAddLink, onRemoveLink, onRestore, trash, onSubtaskCreated }: TaskDrawerProps) {
  const { t } = useTranslation('tasks')
  const { formatDate, formatDateTime } = useDateFormat()
  const { statuses, priorities, doneStatusValues, statusMeta, typeMeta } = useTaskLookups()
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
  // X-36: quick action "Afspraak plannen" modal state (only for tasks linked to a candidate).
  const [openPlanIntake, setOpenPlanIntake] = useState(false)
  // TASK-DISPLAY-DRILL-1: settings read BEFORE the early return (rules of hooks).
  const displaySettings = useAllSettings()
  // Inline-edit-cancel layer: the title input cancels edit mode on Escape.
  useEscapeLayer(editingTitle, () => setEditingTitle(false))
  if (!task) return null

  const startTitleEdit = () => { setTitleDraft(task.title); setEditingTitle(true) }
  const saveTitleEdit = () => { const val = titleDraft.trim(); if (val && val !== task.title) onUpdate(task.id, { title: val }); setEditingTitle(false) }

  // TAKEN-CHIP-KLEUR-BUG-1: the header badge/avatar/subtitle read the LIVE tenant
  // lookup by the raw key, AT RENDER — same fix as DetailsTab.tsx (see its own
  // comment for the full staleness story: task.statusLabel/statusColor/typeLabel
  // are baked once at select/fetch time and never re-derived when a lookup's
  // colour changes or a value is deactivated later).
  // String(): typeKey/statusKey are `string | number` (Task type), the resolvers
  // take `string | null` — same coercion useTasksData's decorate() uses.
  const statusInfo = statusMeta(String(task.statusKey))
  // TASK-DISPLAY-DRILL-1: the header badge/avatar follow the same table toggle —
  // colours off in the table means a neutral drill-down header too.
  const colorStatus = getBoolSetting(displaySettings, 'task_table_color_status', true)
  // Badge takes null (TitleBadge renders its own neutral grey); the AVATAR must get an
  // explicit neutral instead — Avatar falls back to a hashed palette colour on null, so
  // "colours off" would still paint a coloured bubble (predecessor audit, 65ad059e).
  const statusColor = colorStatus ? statusInfo.color : null
  const avatarColor = colorStatus ? (statusInfo.color || NEUTRAL_AVATAR) : NEUTRAL_AVATAR
  const typeInfo = typeMeta(String(task.typeKey))

  // X-36: extract candidate and application IDs from task.links for the quick action.
  const candidateLink = task.links?.find(link => link.type === 'candidate')
  const applicationLink = task.links?.find(link => link.type === 'application')
  const candidateId = candidateLink?.id
  const applicationId = applicationLink?.id

  // Map a tab id to its content component.
  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'details':  return <DetailsTab task={task} onUpdate={patch => onUpdate(task.id, patch)} onSubtaskCreated={() => onSubtaskCreated?.(task.id)} />
      case 'links':    return <LinksTab task={task} onAddLink={link => onAddLink(task.id, link)} onRemoveLink={link => onRemoveLink(task.id, link)} />
      // T5: its own tab now (generalised beyond candidate-only) — was a section
      // pinned under Details.
      case 'related':  return <RelatedTasks task={task} />
      case 'notes':    return <NotesTab task={task} />
      // X-36: timeline tab reads from GET /tasks/{id}/timeline (merged feed).
      case 'timeline': return <TimelineTab task={task} />
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
    // 'extra' slots BEFORE timeline: the canon keeps the history tab at the tail
    // (TIJDLIJN-OVERAL; tasks carry no Statistics tab, so timeline closes the row).
    .flatMap(id => (id === 'timeline' && customFieldDefs.length > 0 ? ['extra', 'timeline'] : [id]))

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
  // Done-ness is resolved LIVE against the lookup's done set, never the baked
  // task.statusIsDone (same stale-bake class as TAKEN-CHIP-KLEUR-BUG-1).
  const doneValue = doneStatusValues[0]
  const markDone = doneValue != null && !doneStatusValues.includes(String(task.statusKey)) && !task.archived
    ? (
      // The house button in its success variant (§4 "aan/gelukt" pair, now a
      // real Button variant — Danny 24-08: "moet huisstijl knop zijn").
      <Button variant="success" size="sm" onClick={() => onUpdate(task.id, { statusKey: doneValue })}>
        <CheckCircle2 size={12} /> {t('drawer.markDone')}
      </Button>
    ) : null

  return (
    <Fragment>
      <EntityDrawer
      entity={task}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Two-sided footer (§3A(8), shared EntityDrawerCreatedAtFooter).
      footer={<EntityDrawerCreatedAtFooter createdAtLabel={t('drawer.createdAt', { date: formatDateTime(task.createdAt) })} />}
      tabs={tabIds.map(id => ({ id, label: t(`drawer.tabs.${id}`), render: () => renderTab(id) }))}
      header={() => (
        <EntityHeader
          // TITEL-CHIP-1 (Danny 19-08): the status badge IS the title — the static
          // entity word doubled with the badge beside the name.
          label={<TitleBadge label={statusInfo.label} color={statusColor} />}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: initialsOf(task.title, 'T'), soft: true, color: avatarColor }}
          renderTitle={() => editingTitle ? (
            // T1: inline title edit — mirror VacancyDrawer's renderTitle swap.
            <TitleEditInput value={titleDraft} onChange={setTitleDraft} onSave={saveTitleEdit} ariaLabel={t('modal.titleLabel')} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <PageTitle as="span" style={{ fontWeight: 700 }}>{task.title}</PageTitle>
                {/* NUMMER-3: the copy chip, right after the title and before the status badge (§3A). */}
                <ReferenceNumberChip value={task.referenceNumber} />
                {/* Status badge — colour-coded, read-only (mirrors the candidate phase badge,
                    §3A(c)); the status meta picker below still handles the actual change. */}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{typeInfo.label || '—'}</div>
            </>
          )}
          // Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — was a
          // cramped 360px dropdown with no focus trap; now the same 900px centred
          // panel as the candidate drawer. ChangelogTab supplies the task's own content.
          titleActions={<ChangelogPopover><ChangelogTab task={task} /></ChangelogPopover>}
          // T1: title pencil → save/cancel, same spot as VacancyDrawer; "mark done"
          // rides alongside it. No pencil on an ARCHIVED task (mirrors every other
          // edit affordance in this drawer — restore first, a deliberate product
          // choice per the meta-picker comment below, not a technical necessity).
          actions={editingTitle ? (
            // DRY round 10, DRAWERSHELLS: save/cancel pair shared via TitleEditActions
            // with VacancyDrawer (clone [13]).
            <TitleEditActions onSave={saveTitleEdit} onCancel={() => setEditingTitle(false)}
              saveLabel={t('common:save')} cancelLabel={t('common:cancel')} />
          ) : (
            <>
              {/* X-36: quick action "Afspraak plannen" (only for tasks linked to a candidate). */}
              {!task.archived && candidateId && (
                <DrawerAddButton label={t('drawer.scheduleAppointment')} onClick={() => setOpenPlanIntake(true)} />
              )}
              {!task.archived && <Button variant="secondary" iconOnly size="sm" onClick={startTitleEdit} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>}
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
      {/* X-36: quick action modal — opens with candidate ID and optional application ID. */}
      {openPlanIntake && candidateId && (
        <PlanIntakeModal
          candidateId={candidateId}
          applicationId={applicationId ?? null}
          onClose={() => setOpenPlanIntake(false)}
          onCreated={() => { setOpenPlanIntake(false) }}
        />
      )}
    </Fragment>
  )
}
