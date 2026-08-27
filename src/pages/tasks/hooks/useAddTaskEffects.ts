/**
 * useAddTaskEffects — the four side-effects that seed/prefill AddTaskModal's
 * form: (1) lookup defaults for status/priority/type, (2) the logged-in-user
 * assignee proposal (create only), (3) resolving a pre-filled candidate/
 * customer/contact id that falls outside its picker's option list, and (4) the
 * edit-mode GET that prefills the whole form. Extracted verbatim (§3 size
 * split, > ~400-line trigger) out of AddTaskModal.tsx — behaviour unchanged,
 * only wired through explicit params/returns instead of closure.
 */
import { useState, useEffect } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { mapTaskDetail } from '../data/mapTask'
import type { NewLink } from '../links/AddLinkRow'
import type { TaskForm } from '../AddTaskModal'
import type { LinkOptionsState } from '../addmodal/useLinkOptions'
import type { Id } from '@/types/common'
import type { ApiTask } from '@/types/task'

interface LookupItem { value: string; label: string; is_default?: boolean }

interface Params {
  form: TaskForm
  setForm: React.Dispatch<React.SetStateAction<TaskForm>>
  statuses: LookupItem[]
  priorities: LookupItem[]
  types: LookupItem[]
  defaultPriority: string
  isEdit: boolean
  meIsAssignable: boolean
  meId: Id | undefined
  linkOptions: LinkOptionsState
  editId?: Id
  setLoadingTask: React.Dispatch<React.SetStateAction<boolean>>
  setOtherLinks: React.Dispatch<React.SetStateAction<NewLink[]>>
  t: TFunction
  onClose: () => void
}

// Seeds/prefills AddTaskModal's form via its four effects; returns the resolved-name
// options for pre-filled ids that fall outside a picker's own option list.
export function useAddTaskEffects({
  form, setForm, statuses, priorities, types, defaultPriority,
  isEdit, meIsAssignable, meId, linkOptions, editId, setLoadingTask, setOtherLinks, t, onClose,
}: Params) {
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
  }, [statuses, priorities, types, defaultPriority]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // KLANTEN 9 screenshot (21-08): a pre-filled link that sits outside the option
  // list's 200-row cap used to render its RAW uuid as the label. Resolve the name by
  // id and inject it as an option, so the picker always shows a name.
  const [resolvedOpts, setResolvedOpts] = useState<Record<string, { value: string; label: string }[]>>({})
  // Resolve any pre-filled candidate/customer/contact id that fell outside the
  // picker's own option list (see the comment above) by fetching its name directly.
  useEffect(() => {
    if (linkOptions.loading) return
    const jobs: Array<[key: 'candidates' | 'customers' | 'contacts', id: string, url: string]> = []
    // Queue a lookup job for one field only when its id is set and unresolved.
    const misses = (key: 'candidates' | 'customers' | 'contacts', id: string, url: string) => {
      if (!id) return
      const known = [...linkOptions[key], ...(resolvedOpts[key] ?? [])].some(o => String(o.value) === String(id))
      if (!known) jobs.push([key, id, url])
    }
    misses('candidates', form.candidateId, `/candidates/${form.candidateId}`)
    misses('customers', form.customerId, `/customers/${form.customerId}`)
    misses('contacts', form.contactId, `/contacts/${form.contactId}`)
    if (!jobs.length) return
    let alive = true
    Promise.all(jobs.map(async ([key, id, url]) => {
      try {
        const d = unwrap<{ name?: string; first_name?: string; last_name?: string }>(await api.get(url))
        const label = d?.name ?? [d?.first_name, d?.last_name].filter(Boolean).join(' ')
        return label ? { key, opt: { value: String(id), label } } : null
      } catch { return null }
    })).then(found => {
      if (!alive) return
      setResolvedOpts(prev => {
        const next = { ...prev }
        for (const f of found) if (f) next[f.key] = [...(next[f.key] ?? []), f.opt]
        return next
      })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately narrow deps: re-running on resolvedOpts (its own setState) would loop; the misses-check already dedupes against the current lists
  }, [linkOptions.loading, form.candidateId, form.customerId, form.contactId])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on editId/isEdit only; the load is a one-shot per edit target
  }, [editId, isEdit])

  return { resolvedOpts }
}
