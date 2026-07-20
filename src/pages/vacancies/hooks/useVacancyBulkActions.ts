/**
 * useVacancyBulkActions — the bulk operations for VacanciesPage: row/all selection
 * toggles, owner/status/client/publish mutations, tag removal, note add and
 * archive. Each mutation is optimistic, persists, then reconciles against the
 * server's `updated`/`archived` list (reverts on failure). Selection state + the
 * toast `notify` live in the container; `statusMeta` comes from the lookups.
 */
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { initialsOf, subsetOf } from '../data/vacanciesShared'
import { useConfirm } from '@/hooks/useConfirm'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

interface BulkUser { id: Id; name: string }
interface BulkCustomer { id: Id; name: string }
interface StatusMetaLike { label?: string; color?: string }

interface UseVacancyBulkActionsArgs {
  vacancies: Vacancy[]
  setVacancies: Dispatch<SetStateAction<Vacancy[]>>
  setTotal: Dispatch<SetStateAction<number>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, text: string) => void
  t: TFunction
  statusMeta: (v?: string | number | null) => StatusMetaLike
}

interface BulkMutateArgs { url: string; body: Record<string, unknown>; patch: Record<string, unknown>; keys: string[]; onSuccess: (n: number) => void }

export function useVacancyBulkActions({ vacancies, setVacancies, setTotal, selectedIds, setSelectedIds, notify, t, statusMeta }: UseVacancyBulkActionsArgs) {
  const { confirm, dialog } = useConfirm()
  // ── Bulk selection ──
  const toggleRow = (id: Id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => { if (allSelected) next.delete(id); else next.add(id) }); return next })

  // Generic optimistic bulk mutation: apply `patch`, persist, reconcile on the
  // server's `updated` list, revert on failure.
  const bulkMutate = ({ url, body, patch, keys, onSuccess }: BulkMutateArgs) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(vacancies.filter(v => v.id != null && ids.includes(v.id)).map(v => [v.id, subsetOf(v as unknown as Record<string, unknown>, keys)]))
    setVacancies(prev => prev.map(v => ids.includes(v.id!) ? ({ ...v, ...patch } as Vacancy) : v))
    api.post(url, { vacancy_ids: ids, ...body })
      .then(res => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setVacancies(prev => prev.map(v => (ids.includes(v.id!) && !updated.has(v.id)) ? ({ ...v, ...snap.get(v.id) } as Vacancy) : v))
        onSuccess(updated ? updated.size : ids.length)
      })
      .catch(() => {
        setVacancies(prev => prev.map(v => ids.includes(v.id!) ? ({ ...v, ...snap.get(v.id) } as Vacancy) : v))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }
  const bulkSetOwner = (user: BulkUser) => bulkMutate({
    url: '/vacancies/bulk/owner', body: { owner_id: user.id },
    patch: { owner: { id: user.id, name: user.name, initials: initialsOf(user.name), color: null } }, keys: ['owner'],
    onSuccess: n => notify('success', t('bulk.ownerChanged', { count: n })),
  })
  const bulkSetStatus = (statusValue: string | number) => { const m = statusMeta(statusValue); bulkMutate({
    url: '/vacancies/bulk/status', body: { status: statusValue },
    patch: { statusValue, statusLabel: m.label, statusColor: m.color }, keys: ['statusValue', 'statusLabel', 'statusColor'],
    onSuccess: n => notify('success', t('bulk.statusChanged', { value: m.label, count: n })),
  }) }
  const bulkSetClient = (customer: BulkCustomer) => bulkMutate({
    url: '/vacancies/bulk/client', body: { customer_id: customer.id },
    patch: { clientId: customer.id, clientName: customer.name }, keys: ['clientId', 'clientName'],
    onSuccess: n => notify('success', t('bulk.clientChanged', { count: n })),
  })
  const bulkPublish = (published: boolean) => bulkMutate({
    url: '/vacancies/bulk/publish', body: { published },
    patch: { published }, keys: ['published'],
    onSuccess: n => notify('success', t(published ? 'bulk.published' : 'bulk.unpublished', { count: n })),
  })

  // Remove a tag from every selected vacancy that has it (optimistic + reconcile).
  const bulkRemoveTag = (tag: string) => {
    const ids = [...selectedIds]
    if (!ids.length || !tag) return
    const changed = vacancies.filter(v => ids.includes(v.id!) && (v.tags ?? []).includes(tag)).map(v => v.id)
    setVacancies(prev => prev.map(v => changed.includes(v.id) ? { ...v, tags: (v.tags ?? []).filter(x => x !== tag) } : v))
    api.post('/vacancies/bulk/tags/remove', { vacancy_ids: ids, tag })
      .then(res => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setVacancies(prev => prev.map(v => (changed.includes(v.id) && !updated.has(v.id)) ? { ...v, tags: [...(v.tags ?? []), tag] } : v))
        notify('success', t('bulk.tagRemoved', { tag, count: updated ? updated.size : changed.length }))
      })
      .catch(() => {
        setVacancies(prev => prev.map(v => changed.includes(v.id) ? { ...v, tags: [...(v.tags ?? []), tag] } : v))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }
  // Add the same note to every selected vacancy (no table column → toast only).
  const bulkAddNote = (text: string) => {
    const ids = [...selectedIds]
    if (!ids.length || !text.trim()) return
    api.post('/vacancies/bulk/notes', { vacancy_ids: ids, text: text.trim() })
      .then(res => notify('success', t('bulk.noteAdded', { count: Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length })))
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }
  // Archive (soft-delete) the selection — confirm first; rows drop on server confirm.
  const bulkArchive = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    confirm(t('bulk.archiveConfirm', { count: ids.length }), () => {
      api.post('/vacancies/bulk/archive', { vacancy_ids: ids })
        .then(res => {
          const archived: Id[] = Array.isArray(res.data?.archived) ? res.data.archived : ids
          const set = new Set(archived)
          setVacancies(prev => prev.filter(v => !set.has(v.id!)))
          setTotal(tt => Math.max(0, tt - archived.length))
          notify('success', t('bulk.archived', { count: archived.length }))
        })
        .catch(() => notify('error', t('bulk.archiveError')))
      setSelectedIds(new Set())
    }, { danger: true })
  }

  // Union of tags across the selected vacancies — the "remove tag" option list.
  const selectedTags = useMemo(() => {
    const set = new Set<string>()
    vacancies.forEach(v => { if (v.id != null && selectedIds.has(v.id)) (v.tags as string[] ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [vacancies, selectedIds])

  return { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkSetClient, bulkPublish, bulkRemoveTag, bulkAddNote, bulkArchive, selectedTags, dialog }
}
