/**
 * useAddTaskSubmit — AddTaskModal's create (POST) and edit (PATCH) submit
 * builders: required-field validation, server-error mapping, the polymorphic
 * `links` assembly and the two API calls themselves. Extracted verbatim (§3
 * size split, > ~400-line trigger) out of AddTaskModal.tsx — behaviour
 * unchanged, only wired through explicit params/returns instead of closure.
 */
import { useState } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrap } from '@/lib/api'
import { API_TO_FORM } from '../addmodal/formHelpers'
import type { NewLink } from '../links/AddLinkRow'
import type { TaskForm } from '../AddTaskModal'
import type { Id } from '@/types/common'

// A polymorphic link {type,id} as sent to the API.
type LinkPair = { type: string; id: string }

interface Params {
  form: TaskForm
  otherLinks: NewLink[]
  extraLinks?: Array<{ type: string; id: string }>
  parentId?: Id
  editId?: Id
  lookupIds: { type: Record<string, string>; status: Record<string, string>; priority: Record<string, string> }
  loadingLookupIds: boolean
  loadingTask: boolean
  onCreated?: (raw: unknown) => void
  onSaved?: (raw: unknown) => void
  t: TFunction
}

// Owns validation, error state and the create/edit submit handlers for AddTaskModal.
export function useAddTaskSubmit({
  form, otherLinks, extraLinks, parentId, editId, lookupIds, loadingLookupIds, loadingTask, onCreated, onSaved, t,
}: Params) {
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  // AUDIT-1 pattern (mirrors AddApplicationModal): a failed create/save keeps the
  // modal open and shows the server's message inline — the old empty catch silently
  // dropped production failures (the dev-only interceptor toast never fires in prod).
  const [createError, setCreateError] = useState<string | null>(null)

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
  // Resolved from the form's slug via `lookupIds`.
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

  // Edit — PATCH with the update-request's REAL keys (see the create handler above
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

  return { errors, setErrors, saving, createError, canSubmit, handleSubmit, handleUpdate }
}
