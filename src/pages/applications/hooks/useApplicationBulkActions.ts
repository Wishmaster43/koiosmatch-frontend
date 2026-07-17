/**
 * useApplicationBulkActions — bulk operations for ApplicationsPage (§0.3 split,
 * mirrors useCandidateBulkActions): row/all selection toggles for the table
 * checkboxes + bulk bar, plus the two bulk mutations (move every selected
 * application to one funnel phase, detach the selection). Each is optimistic;
 * the backend re-validates (§3B).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { bucketOfPhase } from '../data/applicationsShared'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

interface Args {
  setApplications: Dispatch<SetStateAction<Application[]>>
  setTotal: Dispatch<SetStateAction<number>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  funnelTypes: LookupItem[]
  t: TFunction
}

export function useApplicationBulkActions({ setApplications, setTotal, selectedIds, setSelectedIds, funnelTypes, t }: Args) {
  // Row-selection handlers for the table checkboxes + bulk bar.
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const n = new Set(prev); ids.forEach(i => allSelected ? n.delete(i) : n.add(i)); return n })

  // Bulk: move every selected application to one funnel phase; optimistic + PATCH each.
  const bulkSetPhase = (phaseKey: string) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, phaseKey, bucket: bucketOfPhase(phaseKey, funnelTypes) } : a))
    setSelectedIds(new Set())
    Promise.allSettled(ids.map(id => api.patch(`/applications/${id}`, { phase_key: phaseKey })))
      .then(() => notifySuccess(t('bulk.done', { count: ids.length })))
  }

  // Bulk: detach (soft-delete) every selected application; optimistic (incl. the
  // total decrement) + revert-by-id on any failure (see useApplicationDrawerActions'
  // handleDetach note — a whole-array snapshot can't safely revert both the
  // table-page and wide caches).
  const bulkDetach = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, archived: true } : a))
    setTotal(prev => Math.max(0, prev - ids.length))
    setSelectedIds(new Set())
    Promise.allSettled(ids.map(id => api.delete(`/applications/${id}`))).then(rs => {
      if (rs.some(r => r.status === 'rejected')) {
        setApplications(prev => prev.map(a => a.id != null && ids.includes(a.id as Id) ? { ...a, archived: false } : a))
        setTotal(prev => prev + ids.length)
        notifyError(t('common:actionFailed'))
      } else {
        notifySuccess(t('bulk.done', { count: ids.length }))
      }
    })
  }

  return { toggleRow, toggleAll, bulkSetPhase, bulkDetach }
}
