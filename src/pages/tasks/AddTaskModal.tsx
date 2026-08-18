import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useAuth } from '@/context/AuthContext'
import { notifyError } from '@/lib/notify'
import { useTaskLookupIds } from './hooks/useTaskLookupIds'
import { mapTaskDetail } from './data/mapTask'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import FloatingPanel from '@/components/ui/FloatingPanel'
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
import { userName, API_TO_FORM } from './addmodal/formHelpers'
import type { UserLike } from './addmodal/formHelpers'
import type { Id } from '@/types/common'
import type { ApiTask } from '@/types/task'
import Button from '@/components/ui/Button'

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
// A polymorphic link {type,id} as sent to the API.
type LinkPair = { type: string; id: string }

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
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  // AUDIT-1 pattern (mirrors AddApplicationModal): a failed create/save keeps the
  // modal open and shows the server's message inline — the old empty catch silently
  // dropped production failures (the dev-only interceptor toast never fires in prod).
  const [createError, setCreateError] = useState<string | null>(null)
  // Edit mode: loading the task detail to prefill.
  const [loadingTask, setLoadingTask] = useState(isEdit)
  // PUNT 15: every coupling outside the three dedicated pickers — added here by
  // the recruiter AND prefilled from a loaded task, so an edit still never drops
  // a link the PATCH's full-replace `links` would wipe (now visible + removable
  // instead of silently carried).
  const [otherLinks, setOtherLinks] = useState<NewLink[]>([])
  // TASKTYPE-ID-1: slug→uuid FK maps, shared with TasksBoard/useTaskBulkActions —
  // needed by BOTH create and edit now (see the file header comment).
  const { maps: lookupIds, loading: loadingLookupIds } = useTaskLookupIds()

  // Seed sensible defaults once the lookups arrive. Guarded by `|| ` so a value the
  // edit-mode load below already set is never overwritten. Type (like priority via
  // `defaultPriority`) reads the lookup's own `is_default` FLAG first — never array
  // position 0 (§3B lesson: task_types carries no such column yet, so this is an
  // honest no-op today, but it stops guessing the instant a tenant gets one).
  useEffect(() => {
    setForm(f => ({ ...f,
      status:   f.status   || statuses[0]?.value || '',
      priority: f.priority || defaultPriority || '',
      type:     f.type     || types.find(x => x.is_default)?.value || types[0]?.value || '' }))
  }, [statuses, priorities, types, defaultPriority])

  // TASK-ASSIGNEE-DEFAULT-1: propose the logged-in user as assignee ONCE they are
  // known to be assignable — CREATE ONLY (isEdit guard), so the loaded record's own
  // assignee (set by the prefill effect below) is never raced/overwritten. The
  // functional update only fires while assigneeId is still empty, mirroring
  // AddApplicationModal/AddCustomerModal's identical owner-default effect.
  useEffect(() => {
    if (isEdit || !meIsAssignable) return
    setForm(f => (f.assigneeId ? f : { ...f, assigneeId: String(meId) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to assignability/edit-mode resolving, mirrors AddApplicationModal's owner-default effect
  }, [isEdit, meIsAssignable])

  // The three dedicated relational pickers + their honest load state (§3: a
  // failed list used to be swallowed here and read as "no records" — see the hook).
  const linkOptions = useLinkOptions()

  // Edit mode: GET the full task (description/links aren't on the row), then
  // prefill the form. A failed load means there is nothing sensible to edit —
  // notify and close. The slug→uuid FK maps load independently via useTaskLookupIds.
  useEffect(() => {
    if (!isEdit) return
    let alive = true
    setLoadingTask(true)
    api.get(`/tasks/${editId}`).then(taskRes => {
      if (!alive) return
      const detail = mapTaskDetail(unwrap<ApiTask>(taskRes))
      const linkOf = (type: string) => detail.links.find(l => l.type === type)
      const managed = new Set(['candidate', 'customer', 'contact'])
      setOtherLinks(detail.links.filter(l => !managed.has(l.type)).map(l => ({ type: l.type, id: String(l.id), label: l.label ?? '' })))
      setForm(f => ({ ...f,
        type: String(detail.typeKey ?? ''), title: detail.title === '—' ? '' : detail.title,
        assigneeId: detail.assigneeId != null ? String(detail.assigneeId) : '',
        // TEAM-1: prefill the department too, so a save never silently clears it.
        teamId: detail.teamId != null ? String(detail.teamId) : '',
        status: String(detail.statusKey ?? ''), due: detail.due ?? '', dueTime: detail.dueTime ?? '',
        priority: String(detail.priorityKey ?? ''), description: detail.description ?? '',
        candidateId: linkOf('candidate')?.id != null ? String(linkOf('candidate')!.id) : '',
        customerId:  linkOf('customer')?.id  != null ? String(linkOf('customer')!.id)  : '',
        contactId:   linkOf('contact')?.id   != null ? String(linkOf('contact')!.id)   : '',
      }))
    }).catch(() => { notifyError(t('common:actionFailed')); onClose() })
      .finally(() => { if (alive) setLoadingTask(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEdit])

  const set = (k: keyof TaskForm, v: string) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  // Shared required-field check for both create and edit.
  const validateRequired = (): Record<string, boolean> => {
    const e: Record<string, boolean> = {}
    if (!form.title.trim()) e.title = true
    if (!form.type)         e.type  = true
    return e
  }

  // Shared 422/message handling for both create and edit submits.
  const applyServerErrors = (err: unknown) => {
    const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
    const apiErrors = e?.response?.data?.errors
    if (apiErrors) {
      const e2: Record<string, boolean> = {}
      Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
      setErrors(e2)
    } else {
      setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
    }
  }

  // PUNT 15: add/remove a free-vocabulary coupling (deduped on type+id).
  const addOtherLink = (link: NewLink) =>
    setOtherLinks(prev => (prev.some(l => l.type === link.type && l.id === link.id) ? prev : [...prev, link]))
  const removeOtherLink = (link: { type: string; id: string }) =>
    setOtherLinks(prev => prev.filter(l => !(l.type === link.type && l.id === link.id)))

  // Assemble the polymorphic links: free-vocabulary couplings first (in edit mode
  // these include the loaded task's own links, so the full-replace `links` drops
  // none), then the host-supplied ones, then the three single-value pickers.
  // Deduped on type+id: a host seeds e.g. {vacancy,id} while the picker can offer
  // that same vacancy, and the same record must never be coupled twice.
  const buildLinks = (): LinkPair[] => {
    const seen = new Set<string>()
    return ([
      ...otherLinks.map(l => ({ type: l.type, id: l.id })),
      ...(extraLinks ?? []),
      form.candidateId && { type: 'candidate', id: form.candidateId },
      form.customerId  && { type: 'customer',  id: form.customerId },
      form.contactId   && { type: 'contact',   id: form.contactId },
    ].filter(Boolean) as LinkPair[])
      .filter(l => (seen.has(`${l.type}|${l.id}`) ? false : seen.add(`${l.type}|${l.id}`) != null))
  }

  // Create — TASKTYPE-ID-1: POSTs the real uuid FKs (type_id/status_id/priority_id),
  // resolved from the form's slug via `lookupIds` — see the file header comment.
  // StoreTaskRequest silently ignores the bare slugs `type`/`status`/`priority`
  // (not declared rules at all), so this used to land on the tenant's DEFAULT
  // status/type no matter what the recruiter picked; `canSubmit` below blocks the
  // button while `loadingLookupIds` so a fast click can never race an empty map.
  const handleSubmit = async () => {
    const e = validateRequired()
    if (Object.keys(e).length) { setErrors(e); return }

    setSaving(true)
    setCreateError(null)
    try {
      const body = {
        title: form.title.trim(),
        type_id: form.type ? lookupIds.type[form.type] : null,
        status_id: form.status ? lookupIds.status[form.status] : null,
        priority_id: form.priority ? lookupIds.priority[form.priority] : null,
        assignee_id: form.assigneeId || null, due_date: form.due || null, due_time: form.dueTime || null,
        // TEAM-1: the internal department — always sent, null when none is picked.
        assignee_team_id: form.teamId || null,
        description: form.description || null, links: buildLinks(),
        // SUBTASK-1: only present when this modal was opened as "+ subtask" — the
        // key is omitted (never sent as null) for a normal create, so the exact
        // request body existing callers assert never gains a stray key.
        ...(parentId != null ? { parent_id: parentId } : {}),
      }
      const r = await api.post('/tasks', body)
      onCreated?.(unwrap(r))
    } catch (err) {
      applyServerErrors(err)
    } finally { setSaving(false) }
  }

  // Edit — PATCH with the update-request's REAL keys (see the file header comment
  // for the slug-vs-uuid rationale). Keys the form doesn't manage (tags, parent_id,
  // custom_fields, location_id) are simply omitted, leaving them untouched server-side.
  const handleUpdate = async () => {
    const e = validateRequired()
    if (Object.keys(e).length) { setErrors(e); return }

    setSaving(true)
    setCreateError(null)
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        type_id: form.type ? lookupIds.type[form.type] : null,
        // status_id cannot be cleared server-side; an unmapped slug is omitted
        // (via the undefined-strip below) rather than sent as an invalid value.
        status_id: form.status ? lookupIds.status[form.status] : undefined,
        priority_id: form.priority ? lookupIds.priority[form.priority] : null,
        assignee_id: form.assigneeId || null, due_date: form.due || null, due_time: form.dueTime || null,
        // TEAM-1: sent explicitly (never omitted) — omitting the key would leave a
        // cleared department standing, since UpdateTaskRequest uses `sometimes`.
        assignee_team_id: form.teamId || null,
        description: form.description || null, links: buildLinks(),
      }
      Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })
      const r = await api.patch(`/tasks/${editId}`, body)
      onSaved?.(unwrap(r))
    } catch (err) {
      applyServerErrors(err)
    } finally { setSaving(false) }
  }

  // TASKTYPE-ID-1: also blocked while the slug→uuid maps are still loading — see
  // the file header comment (a fast click must never race an empty map).
  const canSubmit = !!(form.title.trim() && form.type) && !saving && !loadingTask && !loadingLookupIds
  // SUBTASK-1: an honest title for the "+ subtask" flow — never silently reuses
  // the generic "Nieuwe taak" wording, which would read like a full standalone create.
  const modalTitle = isEdit ? t('modal.editTitle') : parentId != null ? t('modal.addSubtaskTitle') : t('modal.title')

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position, same overlay/Esc/backdrop semantics as before.
    // Shared footprint (Danny 27-07): WIDE_MODAL still caps the frame; the ONE place
    // to resize the wide trio stays components/ui/modalMetrics.ts.
    <FloatingPanel open onClose={onClose} title={modalTitle} ariaLabel={modalTitle}
      persistKey="add-task" scrollBody={false}
      width={`min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`} maxWidth={`${WIDE_MODAL.maxWidth}px`}>

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
          <TaskCard t={t} form={form} errors={errors} set={set} types={types} />
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
              candidates={linkOptions.candidates} customers={linkOptions.customers} contacts={linkOptions.contacts}
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
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* Footer — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
          <Button variant="secondary" onClick={onClose}>
            {t('modal.cancel')}
          </Button>
          <button onClick={isEdit ? handleUpdate : handleSubmit} disabled={!canSubmit}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'var(--color-on-accent)' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {saving ? t('modal.saving') : isEdit ? t('modal.save') : t('modal.create')}
          </button>
        </div>
    </FloatingPanel>
  )
}
