/**
 * useCustomerBulkActions — the bulk data layer for CustomersPage (§3): row/all
 * selection toggles + the generic optimistic bulkMutate (apply → reconcile on the
 * server's `updated` → revert) and the concrete bulk actions (owner/status/tags/
 * note/archive). Takes the list state + a `notify` callback from the page. Mirrors
 * useCandidateBulkActions / useVacancyBulkActions.
 */
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { useConfirm } from '@/hooks/useConfirm'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'

interface AppUser { id: Id; name: string; avatar_color?: string }
type StatusMeta = (v: string) => { label?: string; color?: string }

interface Args {
  customers: Customer[]
  setCustomers: Dispatch<SetStateAction<Customer[]>>
  setTotal: Dispatch<SetStateAction<number>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, text: string) => void
  statusMeta: StatusMeta
  t: TFunction
}

const subsetOf = (obj: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
  keys.reduce<Record<string, unknown>>((a, k) => { a[k] = obj[k]; return a }, {})

export function useCustomerBulkActions({ customers, setCustomers, setTotal, selectedIds, setSelectedIds, notify, statusMeta, t }: Args) {
  const { confirm, dialog } = useConfirm()
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => { if (allSelected) n.delete(id); else n.add(id) }); return n })

  // Generic optimistic bulk field mutation (apply → reconcile on `updated` → revert).
  const bulkMutate = ({ url, body, patch, keys, onSuccess }: { url: string; body: Record<string, unknown>; patch: Record<string, unknown>; keys: string[]; onSuccess: (n: number) => void }) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(customers.filter(c => c.id != null && ids.includes(c.id)).map(c => [c.id, subsetOf(c as unknown as Record<string, unknown>, keys)]))
    setCustomers(prev => prev.map(c => ids.includes(c.id!) ? ({ ...c, ...patch } as Customer) : c))
    api.post(url, { customer_ids: ids, ...body })
      .then(res => { const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCustomers(prev => prev.map(c => (ids.includes(c.id!) && !updated.has(c.id)) ? ({ ...c, ...snap.get(c.id) } as Customer) : c))
        onSuccess(updated ? updated.size : ids.length) })
      .catch(() => { setCustomers(prev => prev.map(c => ids.includes(c.id!) ? ({ ...c, ...snap.get(c.id) } as Customer) : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }

  const bulkSetOwner  = (user: AppUser)   => bulkMutate({ url: '/customers/bulk/owner', body: { owner_id: user.id },
    patch: { owner: user.name, ownerId: user.id, ownerInitials: initialsOf(user.name), ownerColor: user.avatar_color ?? null },
    keys: ['owner', 'ownerId', 'ownerInitials', 'ownerColor'], onSuccess: n => notify('success', t('bulk.ownerChanged', { name: user.name, count: n })) })
  const bulkSetStatus = (status: string) => bulkMutate({ url: '/customers/bulk/status', body: { status },
    patch: { status, statusLabel: statusMeta(status).label, statusColor: statusMeta(status).color }, keys: ['status', 'statusLabel', 'statusColor'],
    onSuccess: n => notify('success', t('bulk.statusChanged', { value: statusMeta(status).label, count: n })) })

  const selectedTags = useMemo(() => {
    const set = new Set<string>()
    customers.forEach(c => { if (c.id != null && selectedIds.has(c.id)) (c.tags as string[] ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [customers, selectedIds])

  const bulkAddTag = (tag: string) => {
    const t2 = (tag ?? '').trim(); if (!t2) return
    const ids = [...selectedIds]
    const changed = customers.filter(c => ids.includes(c.id!) && !(c.tags ?? []).includes(t2)).map(c => c.id)
    setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), t2] } : c))
    api.post('/customers/bulk/tags', { customer_ids: ids, tag: t2 })
      .then(() => notify('success', t('bulk.tagAdded', { tag: t2, count: changed.length })))
      .catch(() => { setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== t2) } : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }
  const bulkRemoveTag = (tag: string) => {
    const ids = [...selectedIds]
    const changed = customers.filter(c => ids.includes(c.id!) && (c.tags ?? []).includes(tag)).map(c => c.id)
    setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tag) } : c))
    api.post('/customers/bulk/tags/remove', { customer_ids: ids, tag })
      .then(() => notify('success', t('bulk.tagRemoved', { tag, count: changed.length })))
      .catch(() => { setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tag] } : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }
  const bulkAddNote = (text: string) => {
    const ids = [...selectedIds]; if (!ids.length || !text.trim()) return
    api.post('/customers/bulk/notes', { customer_ids: ids, text: text.trim() })
      .then(res => notify('success', t('bulk.noteAdded', { count: Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length })))
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }
  const bulkArchive = () => {
    const ids = [...selectedIds]; if (!ids.length) return
    confirm(t('bulk.archiveConfirm', { count: ids.length }), () => {
      api.post('/customers/bulk/archive', { customer_ids: ids })
        .then(res => { const archived: Id[] = Array.isArray(res.data?.archived) ? res.data.archived : ids; const set = new Set(archived)
          setCustomers(prev => prev.filter(c => !set.has(c.id!))); setTotal(tt => Math.max(0, tt - archived.length))
          notify('success', t('bulk.archived', { count: archived.length })) })
        .catch(() => notify('error', t('bulk.archiveError')))
      setSelectedIds(new Set())
    }, { danger: true })
  }

  return { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkAddTag, bulkRemoveTag, bulkAddNote, bulkArchive, selectedTags, dialog }
}
