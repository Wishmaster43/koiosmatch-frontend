import { useState, useEffect } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { Field, TextField, SelectField, DateField } from '@/components/forms/fields'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { notifyError } from '@/lib/notify'
import { mapTaskDetail } from './data/mapTask'
import { BTN_H } from '@/config/buttonMetrics'
import type { Id } from '@/types/common'
import type { ApiTask } from '@/types/task'

interface EntityRow { id?: Id; name?: string; first_name?: string; last_name?: string; title?: string; email?: string }
interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string }
interface TaskForm {
  type: string; title: string; assigneeId: string; status: string; due: string
  // TASK-DUE-TIME-1: optional "HH:mm" paired with `due`, native <input type="time">.
  dueTime: string; priority: string; description: string
  candidateId: string; customerId: string; contactId: string
}
// A polymorphic link {type,id} as sent to the API.
type LinkPair = { type: string; id: string }
// A raw lookup row ({id,value,...}) — used only to build the slug→uuid maps below.
interface RawLookupRow { id?: string; value?: string }

// Tolerant display name for the linked-entity option lists.
const nameOf = (r: EntityRow): string => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.title || r.email || `#${r.id}`
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// 422 field-error keys are snake_case; map them back to this form's field names.
// `type_id`/`status_id`/`priority_id` are the UPDATE request's real keys (the
// lookup's tenant-facing slug lives under `type`/`status`/`priority` on create) —
// both map to the same form fields so one error handler serves create AND edit.
const API_TO_FORM: Record<string, string> = {
  title: 'title', type: 'type', assignee_id: 'assigneeId', status: 'status',
  due_date: 'due', due_time: 'dueTime', priority: 'priority', description: 'description',
  type_id: 'type', status_id: 'status', priority_id: 'priority',
}

// Slug → uuid FK maps built from the raw lookup endpoints (edit mode only, see below).
const idMapOf = (rows: unknown): Record<string, string> =>
  Object.fromEntries((Array.isArray(rows) ? (rows as RawLookupRow[]) : [])
    .filter((r): r is Required<RawLookupRow> => !!r?.id && !!r?.value)
    .map(r => [r.value, r.id]))

/**
 * AddTaskModal — the "Toevoegen activiteit" dialog, also reused in EDIT mode
 * (Danny 20-07: pencil on a task row). All option lists come from tenant lookups
 * (type/status/priority) or live endpoints (assignee=/users, candidate/customer/
 * contact pickers) — nothing hardcoded.
 *
 * Create POSTs the task with its polymorphic `links[]` and hands the created row
 * back via `onCreated` — UNCHANGED from before (verified byte-for-byte: same body
 * shape, same keys). Edit mode (`editId` set) additionally GETs the full task (the
 * row list doesn't carry description/links), prefills the form, and PATCHes on
 * submit via `onSaved`. The PATCH uses the REAL update-request keys — `type_id`/
 * `status_id`/`priority_id` are uuid FKs, while the tenant lookup's `value` (what
 * this form's selects use) is a slug — so `lookupIds` (fetched alongside the task)
 * resolves slug → FK id. Pre-existing links this form doesn't manage (e.g. an
 * opportunity link) are carried over so the update's full-replace `links` never
 * silently drops them.
 */
export default function AddTaskModal({ onClose, onCreated, onSaved, initial, extraLinks, editId }: {
  onClose: () => void
  onCreated?: (raw: unknown) => void
  // Fired after a successful edit-mode save (PATCH), mirrors `onCreated`.
  onSaved?: (raw: unknown) => void
  initial?: Partial<TaskForm>
  extraLinks?: Array<{ type: string; id: string }>
  // Set → edit mode: GET/prefill/PATCH this task id instead of creating a new one.
  editId?: Id
}) {
  const { t } = useTranslation('tasks')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { types, statuses, priorities, defaultPriority } = useTaskLookups()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const auth = useAuth()
  const ownerName = auth?.user ? userName(auth.user as UserLike) : ''
  const isEdit = editId != null

  // `initial` pre-fills fields/links when opened from an entity drawer (e.g. the candidate).
  const [form, setForm] = useState<TaskForm>({
    type: '', title: '', assigneeId: '', status: '', due: '', dueTime: '', priority: '', description: '',
    candidateId: '', customerId: '', contactId: '', ...initial,
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  // AUDIT-1 pattern (mirrors AddApplicationModal): a failed create/save keeps the
  // modal open and shows the server's message inline — the old empty catch silently
  // dropped production failures (the dev-only interceptor toast never fires in prod).
  const [createError, setCreateError] = useState<string | null>(null)
  // Linked-entity option lists (loaded once; empty/404 keeps the picker empty).
  const [candidates, setCandidates] = useState<EntityRow[]>([])
  const [customers,  setCustomers]  = useState<EntityRow[]>([])
  const [contacts,   setContacts]   = useState<EntityRow[]>([])
  // Edit mode: loading the task detail to prefill; links this form doesn't manage
  // (kept so a PATCH's full-replace `links` never drops them); slug→uuid FK maps.
  const [loadingTask, setLoadingTask] = useState(isEdit)
  const [otherLinks, setOtherLinks] = useState<LinkPair[]>([])
  const [lookupIds, setLookupIds] = useState<{ type: Record<string, string>; status: Record<string, string>; priority: Record<string, string> }>({ type: {}, status: {}, priority: {} })

  // Seed sensible defaults once the lookups arrive (first status + default priority).
  // Guarded by `|| ` so a value the edit-mode load below already set is never overwritten.
  useEffect(() => {
    setForm(f => ({ ...f,
      status:   f.status   || statuses[0]?.value || '',
      priority: f.priority || defaultPriority || '',
      type:     f.type     || types[0]?.value || '' }))
  }, [statuses, priorities, types, defaultPriority])

  // Load the link pickers; each is independent and tolerates a missing endpoint.
  useEffect(() => {
    const load = (url: string, set: (rows: EntityRow[]) => void) => api.get(url).then(r => set(unwrapList<EntityRow>(r).rows)).catch(() => {})
    load('/candidates', setCandidates); load('/customers', setCustomers); load('/contacts', setContacts)
  }, [])

  // Edit mode: GET the full task (description/links aren't on the row) + the raw
  // lookup lists (for the slug→uuid FK maps), then prefill the form. A failed load
  // means there is nothing sensible to edit — notify and close.
  useEffect(() => {
    if (!isEdit) return
    let alive = true
    setLoadingTask(true)
    Promise.all([
      api.get(`/tasks/${editId}`),
      api.get('/task-types').catch(() => ({ data: [] })),
      api.get('/task-statuses').catch(() => ({ data: [] })),
      api.get('/task-priorities').catch(() => ({ data: [] })),
    ]).then(([taskRes, typesRes, statusesRes, prioritiesRes]) => {
      if (!alive) return
      const detail = mapTaskDetail(unwrap<ApiTask>(taskRes))
      const linkOf = (type: string) => detail.links.find(l => l.type === type)
      const managed = new Set(['candidate', 'customer', 'contact'])
      setOtherLinks(detail.links.filter(l => !managed.has(l.type)).map(l => ({ type: l.type, id: String(l.id) })))
      setForm(f => ({ ...f,
        type: String(detail.typeKey ?? ''), title: detail.title === '—' ? '' : detail.title,
        assigneeId: detail.assigneeId != null ? String(detail.assigneeId) : '',
        status: String(detail.statusKey ?? ''), due: detail.due ?? '', dueTime: detail.dueTime ?? '',
        priority: String(detail.priorityKey ?? ''), description: detail.description ?? '',
        candidateId: linkOf('candidate')?.id != null ? String(linkOf('candidate')!.id) : '',
        customerId:  linkOf('customer')?.id  != null ? String(linkOf('customer')!.id)  : '',
        contactId:   linkOf('contact')?.id   != null ? String(linkOf('contact')!.id)   : '',
      }))
      setLookupIds({ type: idMapOf(unwrap(typesRes)), status: idMapOf(unwrap(statusesRes)), priority: idMapOf(unwrap(prioritiesRes)) })
    }).catch(() => { notifyError(t('common:actionFailed')); onClose() })
      .finally(() => { if (alive) setLoadingTask(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEdit])

  const set = (k: keyof TaskForm, v: string) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }
  const toOptions = (rows: EntityRow[]) => rows.map(r => ({ value: String(r.id), label: nameOf(r) }))

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

  // Assemble the polymorphic links from the three single-value pickers, plus any
  // pre-existing links this form doesn't manage (edit mode carries them over via
  // `carryOver` so a PATCH's full-replace `links` never silently drops one).
  const buildLinks = (carryOver: LinkPair[] = []): LinkPair[] => [
    ...carryOver,
    ...(extraLinks ?? []),
    form.candidateId && { type: 'candidate', id: form.candidateId },
    form.customerId  && { type: 'customer',  id: form.customerId },
    form.contactId   && { type: 'contact',   id: form.contactId },
  ].filter(Boolean) as LinkPair[]

  // Create — UNCHANGED body shape/keys (verified against every existing caller).
  const handleSubmit = async () => {
    const e = validateRequired()
    if (Object.keys(e).length) { setErrors(e); return }

    setSaving(true)
    setCreateError(null)
    try {
      const body = {
        title: form.title.trim(), type: form.type, status: form.status, priority: form.priority || null,
        assignee_id: form.assigneeId || null, due_date: form.due || null, due_time: form.dueTime || null,
        description: form.description || null, links: buildLinks(),
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
        description: form.description || null, links: buildLinks(otherLinks),
      }
      Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })
      const r = await api.patch(`/tasks/${editId}`, body)
      onSaved?.(unwrap(r))
    } catch (err) {
      applyServerErrors(err)
    } finally { setSaving(false) }
  }

  const assigneeOpts = [{ value: '', label: t('modal.assigneePlaceholder') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]
  const canSubmit = !!(form.title.trim() && form.type) && !saving && !loadingTask
  const modalTitle = isEdit ? t('modal.editTitle') : t('modal.title')

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={modalTitle} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 880,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{modalTitle}</span>
          <button onClick={onClose} aria-label={t('modal.cancel')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body: main form + details panel, or a loading placeholder while the edit-mode GET is in flight */}
        {loadingTask ? (
          <div style={{ flex: 1, padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('modal.loadingTask')}</div>
        ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', minHeight: 0 }}>
          {/* Main form */}
          <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <Field label={t('modal.type')} required>
              {/* Label only — `icon` holds a lucide NAME, never prefix it as text (2026-07-08). */}
              <SelectField value={form.type} onChange={v => set('type', v)} placeholder={t('modal.typePlaceholder')}
                options={types.map(x => ({ value: x.value, label: x.label }))} style={errors.type ? { borderColor: 'var(--color-danger)' } : {}} />
            </Field>
            <Field label={t('modal.titleLabel')} required>
              <TextField value={form.title} onChange={v => set('title', v)} placeholder={t('modal.titlePlaceholder')} error={errors.title} />
            </Field>
            <Field label={t('modal.assignee')}>
              <SelectField value={form.assigneeId} onChange={v => set('assigneeId', v)} options={assigneeOpts} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('modal.status')}>
                <SelectField value={form.status} onChange={v => set('status', v)} options={statuses.map(x => ({ value: x.value, label: x.label }))} />
              </Field>
              <Field label={t('modal.priority')}>
                <SelectField value={form.priority} onChange={v => set('priority', v)} options={priorities.map(x => ({ value: x.value, label: x.label }))} />
              </Field>
            </div>
            {/* TASK-DUE-TIME-1: date + optional time-of-day, paired half-row. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('modal.due')}>
                <DateField value={form.due} onChange={v => set('due', v)} placeholder="dd-mm-jjjj" />
              </Field>
              <Field label={t('modal.dueTime')}>
                <TextField type="time" value={form.dueTime} onChange={v => set('dueTime', v)} />
              </Field>
            </div>
            {/* Description = note body — same rich editor as the drawer + candidate profile text. */}
            <Field label={t('modal.description')}>
              <RichTextEditor value={form.description} onChange={v => set('description', v)} />
            </Field>
          </div>

          {/* Details panel: owner (read-only) + link pickers */}
          <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg)',
            padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('modal.detailsTitle')}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('modal.owner')}</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{ownerName || '—'}</div>
            </div>
            <Field label={t('modal.candidate')}>
              <SelectField value={form.candidateId} onChange={v => set('candidateId', v)} placeholder={t('modal.candidatePlaceholder')} options={toOptions(candidates)} />
            </Field>
            <Field label={t('modal.customer')}>
              <SelectField value={form.customerId} onChange={v => set('customerId', v)} placeholder={t('modal.customerPlaceholder')} options={toOptions(customers)} />
            </Field>
            <Field label={t('modal.contact')}>
              <SelectField value={form.contactId} onChange={v => set('contactId', v)} placeholder={t('modal.contactPlaceholder')} options={toOptions(contacts)} />
            </Field>
          </div>
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
          <button onClick={onClose}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={isEdit ? handleUpdate : handleSubmit} disabled={!canSubmit}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : '#E5E7EB', color: canSubmit ? '#fff' : '#9CA3AF',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {saving ? t('modal.saving') : isEdit ? t('modal.save') : t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
