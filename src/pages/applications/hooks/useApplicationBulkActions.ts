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
  // The current rows — bulkSetPhase snapshots the phase/bucket it overwrites so a
  // failed move can put every row back exactly where it was (mirrors the sibling
  // drawer-actions hook, which takes the same list for the same reason).
  applications: Application[]
  setApplications: Dispatch<SetStateAction<Application[]>>
  setTotal: Dispatch<SetStateAction<number>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  funnelTypes: LookupItem[]
  t: TFunction
}

export function useApplicationBulkActions({ applications, setApplications, setTotal, selectedIds, setSelectedIds, funnelTypes, t }: Args) {
  // Row-selection handlers for the table checkboxes + bulk bar.
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const n = new Set(prev); ids.forEach(i => allSelected ? n.delete(i) : n.add(i)); return n })

  // Bulk: move every selected application to one funnel phase; optimistic + PATCH each.
  // BULK-PHASE-HONEST-1 (audit 2026-07-25): this used to notify success from a bare
  // .then(), so a rejected phase move (the backend guard refuses the is_rejected stage
  // without a reason, or a permission is missing) still read as "Verplaatst" while
  // nothing moved. It now mirrors bulkDetach right below: revert the rows it touched
  // and surface the failure instead of claiming success.
  const bulkSetPhase = (phaseKey: string) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    // Snapshot the phase/bucket per id BEFORE the optimistic write, so a failure can
    // put each row back where it was (rows may sit in different phases).
    const before = new Map(applications
      .filter(a => a.id != null && selectedIds.has(a.id as Id))
      .map(a => [String(a.id), { phaseKey: a.phaseKey, bucket: a.bucket }]))
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, phaseKey, bucket: bucketOfPhase(phaseKey, funnelTypes) } : a))
    setSelectedIds(new Set())
    Promise.allSettled(ids.map(id => api.patch(`/applications/${id}`, { phase_key: phaseKey }))).then(rs => {
      if (rs.some(r => r.status === 'rejected')) {
        setApplications(prev => prev.map(a => {
          const snap = a.id != null ? before.get(String(a.id)) : undefined
          return snap ? { ...a, ...snap } : a
        }))
        notifyError(t('common:actionFailed'))
      } else {
        notifySuccess(t('bulk.done', { count: ids.length }))
      }
    })
  }

  // Bulk: detach (soft-delete) every selected application; optimistic (incl. the
  // total decrement) + revert-by-id on any failure (see useApplicationDrawerActions'
  // handleDetach note — a whole-array snapshot can't safely revert both the
  // table-page and wide caches). Heraudit-R2 finding 1: the backend REQUIRES a
  // `reason` on DELETE /applications/{id} (S15, same guard as the single-record
  // detach) — sending none 422s every call, so the bar must collect one too.
  const bulkDetach = (reason: string) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, archived: true } : a))
    setTotal(prev => Math.max(0, prev - ids.length))
    setSelectedIds(new Set())
    Promise.allSettled(ids.map(id => api.delete(`/applications/${id}`, { data: { reason } }))).then(rs => {
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
