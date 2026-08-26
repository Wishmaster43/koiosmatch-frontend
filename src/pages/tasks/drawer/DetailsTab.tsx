/**
 * DetailsTab — the task drawer's field cards: the editable core fields
 * (status/priority/assignee/dates/description/…), the Koios advice block and
 * the subtasks section. Field values render PLAIN (colour/chips are a table
 * face only, see TASK-DISPLAY-DRILL-1 below); the pencil→save/cancel edit
 * pattern mirrors every other entity drawer (§3A).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, ExternalLink, Save, X } from 'lucide-react'
import { Field, SelectField, DateField, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import { GroupLabel } from '@/components/ui/typography'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useTaskAdvice } from '@/lib/useTaskAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import { buildTaskAdviceInsights } from './taskAiInsights'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'
import { useUsers } from '@/lib/queries'
import { useTeams } from '@/lib/useTeams'
import { useLocations } from '@/lib/useLocations'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
import { isTaskOverdue, dueDateTime } from '../data/mapTask'
import SubtasksSection from './SubtasksSection'
import Button from '@/components/ui/Button'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'
import type { ReactNode } from 'react'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'

interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string; avatar_color?: string | null }

// Display name for a user record (tolerant of the various shapes /users returns).
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// One read-mode row: muted label left, value right.
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  // Canon (05-08): clean cards — no row dividers, shared label style (fieldRowCanon).
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={CANON_LABEL_STYLE}>{label}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}

// Shared save/cancel icon pair — used by both independently-editable sections below.
function EditControls({ onSave, onCancel, saveLabel, cancelLabel }: { onSave: () => void; onCancel: () => void; saveLabel: string; cancelLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <Button variant="primary" iconOnly size="sm" onClick={onSave} title={saveLabel} aria-label={saveLabel}><Save size={13} /></Button>
      <Button variant="secondary" iconOnly size="sm" onClick={onCancel} title={cancelLabel} aria-label={cancelLabel}><X size={13} /></Button>
    </div>
  )
}

/**
 * DetailsTab — the task's core fields, read by default with an in-place edit
 * (pencil → diskette/✕). Split into two independently-editable sections (Danny
 * 2026-07-28 drill-down audit): the short classification/scheduling/assignee fields
 * share ONE pencil, and the free-text description gets its OWN pencil — mirrors the
 * candidate profile summary (§3A: every prose field edits separately from the short
 * fields around it) — so editing one never discards an in-progress edit on the other.
 * Lookups (type/status/priority) and the assignee come from the tenant lookup +
 * /users; nothing is hardcoded. Owner is always read-only.
 *
 * TEAM-1 (Danny 09-08): a RUNNING task can still be hung on an internal
 * department. "Interne afdeling" rides the same pencil as the assignee — the two
 * belong together (where it waits · who picked it up) and are saved in one patch —
 * but they are INDEPENDENT values: picking a person leaves the department standing
 * (measured: a PATCH with only `assignee_id` returns the same `assignee_team`).
 * Not to be confused with the CUSTOMER department on the Koppelingen tab
 * ("Klantafdeling"); this one is the tenant's own Backoffice/Planning/… .
 */
export default function DetailsTab({ task, onUpdate, onSubtaskCreated }: {
  task: TaskDetail
  onUpdate: (patch: Record<string, unknown>) => void
  // SUBTASK-CREATE-1: local-only tally bump, threaded through to SubtasksSection.
  onSubtaskCreated?: () => void
}) {
  const { t } = useTranslation('tasks')
  // KOIOS-ADVIES-OVERAL-1: the SAME resolver the tasks table's Koios column
  // uses — the advisory block below prepends its advice so the two never disagree.
  const resolveAdvice = useTaskAdvice()
  const { formatDate, formatDateTime } = useDateFormat()
  // TASK-DISPLAY-DRILL-1 (Danny 24-08: "alleen de tabel wordt gekleurd en daar
  // hebben we instellingen voor", i.e. "only the table gets coloured and we
  // have settings for that" + 24-08: "geen chips in drill down, hebben we
  // nergens", i.e. "no chips in the drill-down, we don't have that anywhere"):
  // field cards render PLAIN VALUES — colour and chips are a TABLE
  // face, driven by the task_table_color_* toggles over there; the drilldown
  // reads none of them.
  const displaySettings = useAllSettings()
  const colorAssignee = getBoolSetting(displaySettings, 'task_table_color_assignee', true)
  // Drilldown field cards carry PLAIN values — chips live in the TABLE only
  // (Danny 24-08: "geen chips in drill down, hebben we nergens"; colour stays a
  // table-setting). The old colour-toggle chip render is retired.
  const plainValue = (label: string): ReactNode =>
    <span style={{ color: 'var(--text)', fontSize: 12 }}>{label}</span>
  const { statuses, types, priorities, statusMeta, typeMeta, priorityMeta } = useTaskLookups()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  // TEAM-1: the tenant's internal departments, same shared hook the create modal uses.
  const { teams } = useTeams()
  // TASK-LOCATION-READ-1: the tenant's own establishments, same hook every other
  // entity's branch picker uses (candidates/customers/opportunities/vacancies).
  const locations = useLocations()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  // Description edits independently of the fields above (own pencil/save/cancel).
  const [descEditing, setDescEditing] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [descExpanded, setDescExpanded] = useState(false)
  // TEKST-POPOUT-1: what the read view shows. Follows `task.description`, but a
  // save from the popped-out second-screen window updates it immediately (the
  // prop itself only refreshes once the parent's own PATCH round-trips) —
  // mirrors MatchTextBlock's `shown` state.
  // Safe against cross-record leaks on TWO invariants (verify round 21-08):
  // the drawer is keyed by task id (TasksPage), and the light LIST row never
  // maps `description` (only mapTaskDetail does) — if either changes, resync.
  const [descShown, setDescShown] = useState<string | null | undefined>(task.description)
  useEffect(() => { setDescShown(task.description) }, [task.description])

  // Enter edit mode with a draft seeded from the current field values (description
  // is seeded/saved separately below — it never rides along in this patch).
  const startEdit = () => {
    setDraft({ typeKey: task.typeKey, statusKey: task.statusKey, priorityKey: task.priorityKey,
      due: task.due || '', dueTime: task.dueTime || '', assigneeId: task.assigneeId ?? '',
      teamId: task.teamId ?? '' })
    setEditing(true)
  }
  const setD = (k: string, v: unknown) => setDraft(d => ({ ...d, [k]: v }))

  // Persist the fields block: build the patch (incl. a rebuilt assignee object for
  // the optimistic UI). `handleUpdate` (useTaskDrawerActions) only PATCHes the keys
  // present here, so leaving description out changes nothing about the request shape.
  const save = () => {
    const sel = users.find(u => String(u.id) === String(draft.assigneeId))
    const assignee = sel ? { name: userName(sel), initials: initialsOf(userName(sel)), color: sel.avatar_color ?? null } : null
    // TEAM-1: rebuild the department display object alongside its id so the chip
    // updates optimistically — and carry BOTH axes, so saving a person never
    // sends a patch that reads as "clear the department".
    const team = teams.find(x => String(x.value) === String(draft.teamId))
    onUpdate({ typeKey: draft.typeKey, statusKey: draft.statusKey, priorityKey: draft.priorityKey,
      due: draft.due || '', dueTime: draft.dueTime || '',
      assigneeId: draft.assigneeId || null, assignee,
      teamId: draft.teamId || null, team: team ? { id: team.value, name: team.label, color: team.color } : null })
    setEditing(false)
  }

  // Description block: its own start/save/cancel, isolated from the fields' draft above.
  const startDescEdit = () => { setDescDraft(descShown ?? ''); setDescEditing(true) }
  const saveDesc = () => { onUpdate({ description: descDraft }); setDescEditing(false) }
  const cancelDesc = () => setDescEditing(false)

  // TEKST-POPOUT-1 (TAKEN 2): the description's second-screen affordance, one
  // shared draft between drawer and popped-out window (mirrors MatchTextBlock).
  const descPopout = useTextPopoutHost({
    entity: 'task', id: task.id != null ? String(task.id) : '', field: 'description',
    value: descDraft, dirty: descEditing && descDraft !== (descShown ?? ''),
    onDraft: (html: string) => { setDescDraft(html); setDescEditing(true) },
    onSaved: (html: string) => { setDescDraft(html); setDescShown(html); setDescEditing(false) },
  })
  const changeDescDraft = (html: string) => { setDescDraft(html); descPopout.publishDraft(html) }
  const openDescPopout = () => { if (task.id == null) return; setDescEditing(true); descPopout.open() }

  // `icon` holds a tenant emoji/string (BE task-types R-2) — pass it through so
  // CreatableSelect's own icon slot renders it, never prefix it into the label text.
  const opts = (list: TaskLookupItem[]) => list.map(i => ({ value: i.value, label: i.label, icon: i.icon ? <span>{i.icon}</span> : undefined }))
  const assigneeOpts = [{ value: '', label: t('bureau') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]
  // TEAM-1: internal-department options; "no department" is the picker's clear (X).
  const teamOpts = teams.map(x => ({ value: String(x.value), label: x.label }))
  // TASK-LOCATION-READ-1: branch options for the standalone picker below. A direct
  // meta-style field (no separate pencil, mirrors the header's status/priority/
  // assignee pickers) — it rebuilds the display object alongside the id so the
  // optimistic UI shows the branch name immediately, same as the assignee handler.
  const locationOpts = locations.map(l => ({ value: String(l.value), label: l.label }))
  // Persists the picked location, rebuilding the display object alongside the id so the optimistic UI shows the branch name immediately.
  const onLocationChange = (v: string) => {
    const sel = locations.find(l => String(l.value) === v)
    onUpdate({ locationId: v || null, location: sel ? { id: sel.value, name: sel.label } : null })
  }

  // TAKEN-CHIP-KLEUR-BUG-1: resolve type/status/priority label+colour from the LIVE
  // tenant lookup by the raw key, AT RENDER — never from task.typeLabel/typeColor/…
  // (those are baked once onto the task at select/fetch time in useTaskDrawerActions
  // and never re-derived when a lookup's colour changes or a value is deactivated
  // later — the table never has this bug because useTasksData's decorate() re-runs
  // on every lookup change). Mirrors the table's own resolution path and
  // MatchesTab's metaOf() pattern (§3A reference). A deactivated/unknown value
  // naturally falls back to its raw key + neutral grey, exactly like the table.
  // String(): typeKey/statusKey/priorityKey are `string | number` (Task type),
  // the resolvers take `string | null` — same coercion useTasksData's decorate() uses.
  const typeInfo = typeMeta(String(task.typeKey))
  const statusInfo = statusMeta(String(task.statusKey))
  const priorityInfo = priorityMeta(String(task.priorityKey))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        {/* Header with the edit toggle for the classification/scheduling/assignee block */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{t('details.title')}</GroupLabel>
          {editing ? (
            <EditControls onSave={save} onCancel={() => setEditing(false)} saveLabel={t('comments.send')} cancelLabel={t('modal.cancel')} />
          ) : !task.archived && (
            // No edit on an ARCHIVED task. W2 delivered (measured: TaskController::update
            // is now withTrashed, so the PATCH no longer 404s) — the gating stays anyway:
            // restore first is a deliberate product choice (mirrors the header gating).
            <Button variant="secondary" iconOnly size="sm" onClick={startEdit} title={t('details.title')} aria-label={t('details.title')}>
              <Edit2 size={13} />
            </Button>
          )}
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label={t('details.type')}><SelectField value={draft.typeKey as string} onChange={v => setD('typeKey', v)} options={opts(types)} /></Field>
            <Field label={t('details.status')}><SelectField value={draft.statusKey as string} onChange={v => setD('statusKey', v)} options={opts(statuses)} /></Field>
            <Field label={t('details.priority')}><SelectField value={draft.priorityKey as string} onChange={v => setD('priorityKey', v)} options={opts(priorities)} /></Field>
            {/* TASK-DUE-TIME-1: date + optional time-of-day, paired half-row. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('details.due')}><DateField value={draft.due as string} onChange={v => setD('due', v)} /></Field>
              <Field label={t('details.dueTime')}><TextField type="time" value={draft.dueTime as string} onChange={v => setD('dueTime', v)} /></Field>
            </div>
            {/* T2: the house SEARCHABLE picker (allowCreate=false — assignee is a closed
                tenant-user list, never a free-typed value), mirroring the drawer combobox
                footprint elsewhere (S24c). "Bureau" (unassigned) is a real, pickable option
                — value '' — same as before. */}
            <Field label={t('details.assignee')}>
              <CreatableSelect value={String(draft.assigneeId)} onChange={v => setD('assigneeId', v)} options={assigneeOpts} allowCreate={false} />
            </Field>
            {/* TEAM-1: the INTERNAL department (Backoffice, Planning, …) — a second,
                independent axis next to the person above, never a replacement for
                it. Searchable + clearable, because "no department" really persists. */}
            <Field label={t('details.team')}>
              <CreatableSelect value={String(draft.teamId ?? '')} onChange={v => setD('teamId', v)} options={teamOpts}
                allowCreate={false} clearable clearLabel={t('details.team')} placeholder={t('details.teamPlaceholder')} />
            </Field>
          </div>
        ) : (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Row label={t('details.type')}>{typeInfo.label ? plainValue(typeInfo.label) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
            <Row label={t('details.status')}>{statusInfo.label ? plainValue(statusInfo.label) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
            <Row label={t('details.priority')}>{priorityInfo.label ? plainValue(priorityInfo.label) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</Row>
            <Row label={t('details.due')}>
              <span style={{ fontSize: 12, color: task.due ? (isTaskOverdue(task) ? 'var(--color-danger)' : 'var(--text)') : 'var(--text-muted)', fontWeight: isTaskOverdue(task) ? 600 : 400 }}>
                {/* TASK-DUE-TIME-1: DD-MM-YYYY HH:mm when a time is set, date-only otherwise. */}
                {task.due ? (task.dueTime ? formatDateTime(dueDateTime(task.due, task.dueTime)) : formatDate(task.due)) : '—'}
              </span>
            </Row>
            <Row label={t('details.assignee')}>
              {task.assignee ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Explicit neutral when colours are off: Avatar hashes a palette colour on null. */}
                  <Avatar initials={task.assignee.initials} size={20} color={colorAssignee ? (task.assignee.color || NEUTRAL_AVATAR) : NEUTRAL_AVATAR} />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{task.assignee.name}</span>
                </span>
              ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('bureau')}</span>}
            </Row>
            {/* TEAM-1: the department chip — the lookup's own colour in the §4
                soft-tint (SoftChip), mirroring how status/type/priority read. */}
            <Row label={t('details.team')}>
              {task.team
                ? <SoftChip label={task.team.name} color={task.team.color} />
                : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
            </Row>
            <Row label={t('details.owner')}><span style={{ fontSize: 12, color: 'var(--text)' }}>{task.owner?.name || '—'}</span></Row>
          </div>
        )}
      </div>

      {/* SUBTASK-1: own subtasks (fetched with ?parent_id=) and/or a reference to the
          main task when this task itself is a subtask — renders nothing otherwise. */}
      <SubtasksSection task={task} onSubtaskCreated={onSubtaskCreated} />

      <div>
        {/* Description — free-text rich block, own pencil (§3A: every prose field gets
            its own save/cancel, never bundled with the short fields above). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{t('details.description')}</GroupLabel>
          {descEditing ? (
            <EditControls onSave={saveDesc} onCancel={cancelDesc} saveLabel={t('comments.send')} cancelLabel={t('modal.cancel')} />
          ) : !task.archived && (
            <div style={{ display: 'flex', gap: 4 }}>
              {/* TEKST-POPOUT-1 (TAKEN 2): write the description full-size on a
                  second screen — the shared house recipe (§3A), never a
                  bespoke widget. */}
              {task.id != null && (
                <Button variant="secondary" iconOnly size="sm" onClick={openDescPopout}
                  title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}>
                  <ExternalLink size={13} />
                </Button>
              )}
              <Button variant="ghost" iconOnly size="sm" onClick={startDescEdit} title={t('details.description')} aria-label={t('details.description')}>
                <Edit2 size={13} />
              </Button>
            </div>
          )}
        </div>
        {descEditing ? (
          // PUNT 16 (spraak-icoon op taak-acties): the mic rides the SHARED
          // RichTextAssistBar that RichTextEditor mounts on every editor — the same
          // KoiosVoiceButton the note composer uses. Never pass a second local mic
          // here (that renders two identical buttons, §11).
          <RichTextEditor value={descDraft} onChange={changeDescDraft}
            expanded={descExpanded} onToggleExpand={() => setDescExpanded(e => !e)} />
        ) : (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', padding: '9px 12px' }}>
            {descShown
              ? <SafeHtml html={descShown} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
          </div>
        )}
      </div>

      {/* T4: Koios advice block, bottom of Details (mirrors the vacancy drawer's own
          bottom placement) — the table-identical advice row first (KOIOS-ADVIES-
          OVERAL-1; [] when there is none), then the deadline/assignment/links
          heuristics from data already on the record, no AI/API call. */}
      <KoiosAdviceBlock namespace="tasks"
        insights={[...adviceInsightRows(resolveAdvice(task)), ...buildTaskAdviceInsights(task, t)]} />

      {/* T3 / TASK-LOCATION-READ-1: the Vestiging (branch) picker, below the advice
          block per Danny's layout. Previously blocked (write-only field — the
          resource never serialised it, so a picker could set it but never confirm
          the saved value, a fake affordance §3) — now unblocked: TaskListResource/
          TaskDetailResource emit `location {id,name}|null` and index()/show() eager-
          load the relation (BE golf 2a/2b, 2026-08-08). No edit affordance on an
          ARCHIVED task (same gating as every other field above). */}
      <div>
        {task.archived ? (
          <Row label={t('details.location')}>
            <span style={{ fontSize: 12, color: task.location?.name ? 'var(--text)' : 'var(--text-muted)' }}>
              {task.location?.name || '—'}
            </span>
          </Row>
        ) : (
          <Field label={t('details.location')}>
            <CreatableSelect
              value={task.location?.id != null ? String(task.location.id) : ''}
              onChange={onLocationChange}
              options={locationOpts}
              allowCreate={false}
              clearable
              clearLabel={t('details.location')}
              placeholder={t('details.locationPlaceholder')}
            />
          </Field>
        )}
      </div>
    </div>
  )
}
