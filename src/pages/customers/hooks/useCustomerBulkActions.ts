/**
 * useCustomerBulkActions — the bulk data layer for CustomersPage (§3): row/all
 * selection toggles + the generic optimistic bulkMutate (apply → reconcile on the
 * server's `updated` → revert) and the concrete bulk actions (owner/status/tags/
 * note/archive). Takes the list state + a `notify` callback from the page. Mirrors
 * useCandidateBulkActions / useVacancyBulkActions. `bulkCoupleBackoffice` is built
 * on the shared useBackofficeCoupleBulk (src/hooks/) now that candidates/matches
 * carry the exact same action.
 */
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { useConfirm } from '@/hooks/useConfirm'
import { useBackofficeCoupleBulk } from '@/hooks/useBackofficeCoupleBulk'
import { useBulkSelectionToggles } from '@/hooks/useBulkSelectionToggles'
import { bulkNotesPost, bulkArchivePost } from '@/lib/bulkEntityPost'
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

// Bulk-action data layer for CustomersPage: selection toggles, the generic optimistic bulkMutate, and the concrete bulk actions built on it.
export function useCustomerBulkActions({ customers, setCustomers, setTotal, selectedIds, setSelectedIds, notify, statusMeta, t }: Args) {
  const { confirm, dialog } = useConfirm()
  // r2-react-query-1: the KPI/donut row (useCustomersData's `['customers', 'stats', …]`
  // query) must never go stale after a bulk field mutation — invalidated below on every
  // successful bulkMutate call, never on a failed one.
  const queryClient = useQueryClient()
  const { toggleRow, toggleAll } = useBulkSelectionToggles(setSelectedIds)

  // Generic optimistic bulk field mutation (apply → reconcile on `updated` → revert).
  const bulkMutate = ({ url, body, patch, keys, onSuccess }: { url: string; body: Record<string, unknown>; patch: Record<string, unknown>; keys: string[]; onSuccess: (n: number) => void }) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(customers.filter(c => c.id != null && ids.includes(c.id)).map(c => [c.id, subsetOf(c as unknown as Record<string, unknown>, keys)]))
    setCustomers(prev => prev.map(c => ids.includes(c.id!) ? ({ ...c, ...patch } as Customer) : c))
    api.post(url, { customer_ids: ids, ...body })
      .then(res => { const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCustomers(prev => prev.map(c => (ids.includes(c.id!) && !updated.has(c.id)) ? ({ ...c, ...snap.get(c.id) } as Customer) : c))
        onSuccess(updated ? updated.size : ids.length)
        // r2-react-query-1: a bulk field mutation (owner/status) can move a KPI/donut
        // distribution — invalidate the stats query so the InsightsRow refetches instead
        // of showing stale counts until the next full page reload.
        queryClient.invalidateQueries({ queryKey: ['customers', 'stats'] }) })
      .catch(() => { setCustomers(prev => prev.map(c => ids.includes(c.id!) ? ({ ...c, ...snap.get(c.id) } as Customer) : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }

  const bulkSetOwner  = (user: AppUser)   => bulkMutate({ url: '/customers/bulk/owner', body: { owner_id: user.id },
    patch: { owner: user.name, ownerId: user.id, ownerInitials: initialsOf(user.name), ownerColor: user.avatar_color ?? null },
    keys: ['owner', 'ownerId', 'ownerInitials', 'ownerColor'], onSuccess: n => notify('success', t('bulk.ownerChanged', { name: user.name, count: n })) })
  const bulkSetStatus = (status: string) => bulkMutate({ url: '/customers/bulk/status', body: { status },
    patch: { status, statusLabel: statusMeta(status).label, statusColor: statusMeta(status).color }, keys: ['status', 'statusLabel', 'statusColor'],
    onSuccess: n => notify('success', t('bulk.statusChanged', { value: statusMeta(status).label, count: n })) })

  // Tags present across every currently selected customer, for the bulk tag-remove picker's option list.
  const selectedTags = useMemo(() => {
    const set = new Set<string>()
    customers.forEach(c => { if (c.id != null && selectedIds.has(c.id)) (c.tags as string[] ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [customers, selectedIds])

  // Optimistically add a tag to every selected customer; revert just the ones it failed to stick to.
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
  // Optimistically remove a tag from every selected customer; revert on failure.
  const bulkRemoveTag = (tag: string) => {
    const ids = [...selectedIds]
    const changed = customers.filter(c => ids.includes(c.id!) && (c.tags ?? []).includes(tag)).map(c => c.id)
    setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tag) } : c))
    api.post('/customers/bulk/tags/remove', { customer_ids: ids, tag })
      .then(() => notify('success', t('bulk.tagRemoved', { tag, count: changed.length })))
      .catch(() => { setCustomers(prev => prev.map(c => changed.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tag] } : c)); notify('error', t('bulk.mutateError')) })
    setSelectedIds(new Set())
  }
  // Post one note to every selected customer; no optimistic patch since notes don't show on the row.
  const bulkAddNote = bulkNotesPost({ entity: 'customers', idsKey: 'customer_ids', selectedIds, setSelectedIds, notify, t })
  // Archive every selected customer after a danger-confirm; drops the archived rows from the list and adjusts the total.
  const bulkArchive = bulkArchivePost({
    entity: 'customers', idsKey: 'customer_ids', selectedIds, setSelectedIds, setItems: setCustomers, setTotal, confirm, notify, t,
  })

  // GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" for the selection. Queued +
  // rate-limited (202) — no optimistic row patch, no reconcile, just fire the
  // bulk POST and say "started" (never "done"; mirrors bulkGeocode on candidates).
  const bulkGeocode = () => {
    const ids = [...selectedIds]; if (!ids.length) return
    setSelectedIds(new Set())
    api.post('/customers/bulk/geocode', { customer_ids: ids })
      .then(() => notify('success', t('common:geocode.started')))
      .catch(() => notify('error', t('bulk.mutateError')))
  }

  // SYNC-BULK-1 (§3B — bulk is the 3rd of the three backoffice-coupling paths;
  // manual is BackofficeLinksTab, workflow is a module). Built on the shared
  // useBackofficeCoupleBulk (see its file doc for the endpoint/toast contract) —
  // customers' target-label lookup and 'warning' partial tone are its defaults.
  const bulkCoupleBackoffice = useBackofficeCoupleBulk({
    entity: 'customers', selectedIds, setSelectedIds, notify, t,
    targetLabel: system => t(`common:backofficeLinks.${system}.name`),
  })

  return { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkAddTag, bulkRemoveTag, bulkAddNote, bulkArchive, bulkGeocode, bulkCoupleBackoffice, selectedTags, dialog }
}
