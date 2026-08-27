import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useAuth } from '@/context/AuthContext'
import { useTaskLookupIds } from './hooks/useTaskLookupIds'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { tintBorder } from '@/lib/tint'
import FloatingPanel from '@/components/ui/FloatingPanel'
import TitleBarPills from '@/components/ui/TitleBarPills'
import { modalColumns } from '@/components/ui/modalCards'
import TaskCard from './addmodal/TaskCard'
import PlanningCard from './addmodal/PlanningCard'
import LinkCard from './addmodal/LinkCard'
import AssignmentCard from './addmodal/AssignmentCard'
import DescriptionCard from './addmodal/DescriptionCard'
import type { NewLink } from './links/AddLinkRow'
import { todayISO, nextRoundHour } from './addmodal/defaults'
import { useAssigneeOptions } from './addmodal/useAssigneeOptions'
import { useTeams } from '@/lib/useTeams'
import { useLinkOptions } from './addmodal/useLinkOptions'
import { userName } from './addmodal/formHelpers'
import type { UserLike } from './addmodal/formHelpers'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'
import { useAddTaskEffects } from './hooks/useAddTaskEffects'
import { useAddTaskSubmit } from './hooks/useAddTaskSubmit'

// Exported so the addmodal/ card components share this exact shape (type-only import).
export interface TaskForm {
  type: string; title: string; assigneeId: string; status: string; due: string
  // TEAM-1: the INTERNAL department the task waits at (`assignee_team_id`).
  // Independent of `assigneeId` — see the header comment.
  teamId: string
  // TASK-DUE-TIME-1: optional "HH:mm" paired with `due`, native <input type="time">.
  dueTime: string; priority: string; description: string
  candidateId: string; customerId: string; contactId: string
}

/**
 * AddTaskModal — the "Nieuwe taak" dialog, also reused in EDIT mode (Danny 20-07:
 * pencil on a task row). All option lists come from tenant lookups (type/status/
 * priority) or live endpoints (assignee=/users, candidate/customer/contact pickers) —
 * nothing hardcoded.
 *
 * Popup redesign (Danny 27-07 #tasks): the entity is a TAAK — "Activiteit" only
 * names its TYPE field now (the naming fix lives in tasks.json's values, not here).
 * The form itself moved onto the shared WIDE_MODAL frame (same footprint as +Match/
 * +Kandidaat): a thin container composing titled bordered cards, each split into
 * `addmodal/` (§3A: container wires data, one component per card). Every dropdown
 * is now a searchable CreatableSelect (allowCreate={false}: type/status/priority/
 * assignee/candidate/customer/contact are all real tenant/relational values, never
 * a free-text create).
 *
 * TASK-SMART-DEFAULTS-1 (Danny: "+ Nieuwe taak is minder mooi en intelligent dan +
 * match — de datum is netjes gevuld etc."): brought up to +Match's two-axis
 * standard. LOOK — a fourth card split off the old combined "Koppeling": Taak ·
 * Planning · Koppelingen (linked record) · Toewijzing (assignee + creator), laid
 * out full-width-then-paired exactly like +Match's Relaties-then-Contract/
 * Financieel (`cardPair`, shared with every other wide modal). INTELLIGENCE
 * (create only — never overwrites a loaded edit record): the due date/time propose
 * today + the next round hour (`addmodal/defaults`, since +Match's own todayISO
 * start-date proposal has no time-of-day field to mirror and lives in another
 * entity's folder, §2); the assignee proposes the logged-in user via the SAME
 * assignable-tenant-user guard as AddApplicationModal/AddCustomerModal
 * (`meIsAssignable`); Soort activiteit now reads the lookup's `is_default` flag
 * (mirrors `defaultPriority`) instead of guessing array position 0 (§3B lesson) —
 * inert today (no tenant sends `is_default` for task_types yet) but honest and
 * future-proof, exactly like useEndDateProposal's stance on an unshipped column.
 *
 * TASKTYPE-ID-1 (measured: Store/UpdateTaskRequest only validate `type_id`/
 * `status_id`/`priority_id` — uuid, exists:* — the bare slugs `type`/`status`/
 * `priority` aren't declared rules at all, so Laravel's `validated()` drops them
 * silently; a create used to land on the TENANT DEFAULT status/type/priority no
 * matter what the recruiter picked). Both CREATE (POST) and EDIT (PATCH) now send
 * the real uuid FKs. The tenant lookup's `value` (what this form's selects use) is
 * a slug, so `lookupIds` (`useTaskLookupIds`, shared with TasksBoard/
 * useTaskBulkActions — TaskLookupsContext itself only exposes the slug, see that
 * hook's header comment) resolves slug → FK id for both submit paths; the Create/
 * Save button stays disabled while it's still loading (`loadingLookupIds`) so a
 * fast click can never silently omit the id and fall back to a tenant default.
 * Create hands the created row back via `onCreated`; only the VALUES of
 * due_date/due_time/assignee_id/type may carry a proposed default instead of
 * always being empty (see TASK-SMART-DEFAULTS-1 above). Edit mode (`editId` set)
 * additionally GETs the full task (the row list doesn't carry description/links),
 * prefills the form, and PATCHes on submit via `onSaved`. Pre-existing links this
 * form doesn't manage (e.g. an opportunity link) are carried over so the update's
 * full-replace `links` never silently drops them.
 *
 * PUNT 14/15/16 (Danny 08-08). 14: "Omschrijving" moved out of the FIRST card
 * into its own DescriptionCard rendered LAST, under every short field — order
 * only, same key in the same body. 15: a create can now couple the task to the
 * WHOLE shared link vocabulary through the drawer's own `AddLinkRow` +
 * `links/taskLinkTypes` (measured: StoreTaskRequest validates `links.*.type`
 * with `Rule::in(TaskLinkResolver::types())`; a live POST with department/
 * location/opportunity links returned 201 with all three resolved). 16: the
 * description's mic comes from RichTextEditor's shared RichTextAssistBar (the
 * same KoiosVoiceButton notes use) — never a local one, that renders a second
 * button (§11).
 *
 * ASSIGN-TO-BACKOFFICE / TEAM-1 (Danny 08-08, delivered 09-08 once the backend
 * shipped it — commit e0e2277f). Assigning a task to an internal DEPARTMENT is
 * now real and NON-EXCLUSIVE: `assignee_team_id` says WHERE the task waits
 * (Backoffice), `assignee_id` says WHO picked it up, and the two live side by
 * side in this card. Measured live 09-08: `GET /teams` → 200, `POST /tasks` with
 * `assignee_team_id` → 201 echoing `assignee_team{id,name,color}`, and a PATCH
 * carrying ONLY `assignee_id` returns that same `assignee_team` — assigning a
 * person never wipes the department. So BOTH submit paths below always send
 * `assignee_team_id` (null when cleared, never omitted — an omitted key cannot
 * clear a value). The colleague picker keeps its role grouping and the explicit
 * "Bureau" row (see `addmodal/assigneeOptions`); the department list comes from
 * the shared `@/lib/useTeams`.
 *
 * `lockCustomerId`/`lockCustomerName` (Danny 28-07, "+ Nieuwe taak" from the
 * customer drawer) mirror AddVacancyModal's `lockCustomerId` pattern: the
 * customer is already known from the drawer it was opened in, so LinkCard
 * renders it as read-only text instead of a picker the recruiter could
 * accidentally repoint to a different customer.
 */
export default function AddTaskModal({ onClose, onCreated, onSaved, initial, extraLinks, editId, lockCustomerId, lockCustomerName, parentId }: {
  onClose: () => void
  onCreated?: (raw: unknown) => void
  // Fired after a successful edit-mode save (PATCH), mirrors `onCreated`.
  onSaved?: (raw: unknown) => void
  initial?: Partial<TaskForm>
  extraLinks?: Array<{ type: string; id: string }>
  // Set → edit mode: GET/prefill/PATCH this task id instead of creating a new one.
  editId?: Id
  // Opened from a customer drawer: the customer link is fixed and shown read-only.
  lockCustomerId?: string; lockCustomerName?: string
  // SUBTASK-1: opened from the "+ subtask" affordance in SubtasksSection — the
  // CREATED task is filed as a subtask of this task. Programmatic only (§0.4 rule 4
  // of the brief: no main-task picker in the general form) — never surfaced as a
  // field the user can pick/clear here.
  parentId?: Id
}) {
  const { t } = useTranslation('tasks')
  const { types, statuses, priorities, defaultPriority } = useTaskLookups()
  // The assignee field's whole data half — the role-grouped colleague options,
  // the raw user list the assignability guard below needs, and the four load
  // states AssignmentCard renders (see addmodal/useAssigneeOptions).
  const { users, options: assigneeOpts, loading: usersLoading, error: usersError, retry: retryUsers, hasColleagues } = useAssigneeOptions()
  // TEAM-1: the tenant's internal departments (GET /teams) — the second, independent
  // half of "toewijzing". Shared hook, so a future settings screen reads the same cache.
  const { teams, loading: teamsLoading, error: teamsError, retry: retryTeams } = useTeams()
  const auth = useAuth()
  const ownerName = auth?.user ? userName(auth.user as UserLike) : ''
  const isEdit = editId != null
  // TASK-ASSIGNEE-DEFAULT-1: the assignee proposal below may only fire for a
  // logged-in user who is actually an assignable tenant user (present in the SAME
  // /users list the picker itself offers) — mirrors AddApplicationModal/
  // AddCustomerModal's identical owner-default guard, never a super-admin/
  // non-tenant id the backend's assigneeRule() would 422 on.
  const meId = auth?.user?.id
  const meIsAssignable = meId != null && users.some(u => String(u.id) === String(meId))

  // `initial` pre-fills fields/links when opened from an entity drawer (e.g. the
  // candidate); `lockCustomerId` (the customer-drawer trigger) seeds customerId the
  // same way but additionally makes LinkCard render it read-only, see below. The
  // due date/time PROPOSE today + the next round hour (TASK-SMART-DEFAULTS-1) —
  // CREATE ONLY: in edit mode the loaded record's own value (`due: ''` here) is
  // what the prefill effect below fills in, and must never be pre-empted by a
  // "today" flash. Lazy initializer so `new Date()` is read once, at mount.
  const [form, setForm] = useState<TaskForm>(() => ({
    type: '', title: '', assigneeId: '', teamId: '', status: '',
    due: isEdit ? '' : todayISO(), dueTime: isEdit ? '' : nextRoundHour(),
    priority: '', description: '',
    candidateId: '', customerId: lockCustomerId ?? '', contactId: '', ...initial,
  }))
  // Edit mode: loading the task detail to prefill.
  const [loadingTask, setLoadingTask] = useState(isEdit)
  // PUNT 15: every coupling outside the three dedicated pickers — added here by
  // the recruiter AND prefilled from a loaded task, so an edit still never drops
  // a link the PATCH's full-replace `links` would wipe (now visible + removable
  // instead of silently carried).
  const [otherLinks, setOtherLinks] = useState<NewLink[]>([])
  // TASKTYPE-ID-1: slug→uuid FK maps, shared with TasksBoard/useTaskBulkActions —
  // Needed by BOTH create and edit now.
  const { maps: lookupIds, loading: loadingLookupIds } = useTaskLookupIds()

  // The three dedicated relational pickers + their honest load state (§3: a
  // failed list used to be swallowed here and read as "no records" — see the hook).
  const linkOptions = useLinkOptions()

  // The four seed/prefill effects (lookup defaults, assignee proposal, id-name
  // resolution, edit-mode load) live in their own hook (§3 size split).
  const { resolvedOpts } = useAddTaskEffects({
    form, setForm, statuses, priorities, types, defaultPriority,
    isEdit, meIsAssignable, meId, linkOptions, editId, setLoadingTask, setOtherLinks, t, onClose,
  })

  // PUNT 15: add/remove a free-vocabulary coupling (deduped on type+id).
  const addOtherLink = (link: NewLink) =>
    setOtherLinks(prev => (prev.some(l => l.type === link.type && l.id === link.id) ? prev : [...prev, link]))
  const removeOtherLink = (link: { type: string; id: string }) =>
    setOtherLinks(prev => prev.filter(l => !(l.type === link.type && l.id === link.id)))

  // Validation, error state and the create/edit submit handlers (§3 size split).
  const { errors, setErrors, saving, createError, canSubmit, handleSubmit, handleUpdate } = useAddTaskSubmit({
    form, otherLinks, extraLinks, parentId, editId, lookupIds, loadingLookupIds, loadingTask, onCreated, onSaved, t,
  })

  const set = (k: keyof TaskForm, v: string) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  // SUBTASK-1: an honest title for the "+ subtask" flow — never silently reuses
  // the generic "Nieuwe taak" wording, which would read like a full standalone create.
  const modalTitle = isEdit ? t('modal.editTitle') : parentId != null ? t('modal.addSubtaskTitle') : t('modal.title')

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position, same overlay/Esc/backdrop semantics as before.
    // Shared footprint (Danny 27-07): WIDE_MODAL still caps the frame; the ONE place
    // to resize the wide trio stays components/ui/modalMetrics.ts.
    <FloatingPanel open onClose={onClose} ariaLabel={modalTitle}
      persistKey="add-task" scrollBody={false}
      width={`min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`} maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        // TITELBALK-PILLS (Danny 27-08): the Soort activiteit choice moves OUT of
        // TaskCard and into the title bar, via the shared TitleBarPills atom —
        // same idiom as AddCandidateModal/AddVacancyModal/MatchModal. Required
        // field: no `clearable`, the active pill always stays picked.
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 100%' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{modalTitle}</div>
          <TitleBarPills
            options={types.map(x => ({ value: x.value, label: x.icon ? `${x.icon} ${x.label}` : x.label, color: x.color }))}
            value={form.type} onChange={v => set('type', v)} ariaLabel={t('modal.type')} />
        </div>
      }>

        {/* Body: titled cards — Taak full-width, then Planning+Toewijzing (left,
            stacked) paired against Koppelingen (right) — mirrors +Match's
            Relaties-then-Contract/Financieel layout (`cardPair`, shared with every
            other wide modal) — and finally the full-width Omschrijving (PUNT 14:
            the free-text block sits UNDER every other field now, not above them).
            Or a loading placeholder while the edit-mode GET is in flight. */}
        {loadingTask ? (
          <div style={{ flex: 1, padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('modal.loadingTask')}</div>
        ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TaskCard t={t} form={form} errors={errors} set={set} />
          {/* CARD-COLUMNS-CANON: the shared modalColumns grid (§11, mirrors
              AddCustomerModal/MatchModal) — was the local `cardPair` alias. */}
          <div style={modalColumns()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <PlanningCard t={t} form={form} set={set} priorities={priorities} statuses={statuses} />
              <AssignmentCard t={t} form={form} set={set} ownerName={ownerName} assigneeOpts={assigneeOpts}
                usersLoading={usersLoading} usersError={usersError} hasColleagues={hasColleagues} onRetryUsers={retryUsers}
                teams={teams} teamsLoading={teamsLoading} teamsError={teamsError} onRetryTeams={retryTeams} />
            </div>
            <LinkCard t={t} form={form} set={set}
              candidates={[...linkOptions.candidates, ...(resolvedOpts.candidates ?? [])]}
              customers={[...linkOptions.customers, ...(resolvedOpts.customers ?? [])]}
              contacts={[...linkOptions.contacts, ...(resolvedOpts.contacts ?? [])]}
              optionsLoading={linkOptions.loading} optionsError={linkOptions.error} onRetryOptions={linkOptions.retry}
              lockCustomerId={lockCustomerId} lockCustomerName={lockCustomerName}
              extraLinks={otherLinks} onAddExtra={addOtherLink} onRemoveExtra={removeOtherLink} />
          </div>
          <DescriptionCard t={t} form={form} set={set} />
        </div>
        )}

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 24px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
            border: tintBorder('var(--color-danger)', true), flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* Footer — Button owns the height (sm, 28px) for every text/action button, everywhere. */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
          <Button variant="secondary" onClick={onClose}>
            {t('modal.cancel')}
          </Button>
          <Button variant="primary" onClick={isEdit ? handleUpdate : handleSubmit} disabled={!canSubmit}>
            {saving ? t('modal.saving') : isEdit ? t('modal.save') : t('modal.create')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
