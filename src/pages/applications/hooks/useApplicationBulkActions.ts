/**
 * useApplicationBulkActions — bulk operations for ApplicationsPage (§0.3 split,
 * mirrors useCandidateBulkActions): row/all selection toggles for the table
 * checkboxes + bulk bar, plus the two bulk mutations the bar actually offers
 * (move the selection to one funnel phase, detach the selection).
 * BULK-ROUTE-1 (2026-08-14): the backend now ships real bulk routes
 * (POST /applications/bulk/{stage,detach}, confirmed 14-08) instead of the old
 * per-id PATCH/DELETE loop with all-or-nothing revert. Each call sends one
 * request with `application_ids`; the response's `updated` list drives the
 * reconcile (rows NOT in `updated` snap back) and `skipped` — [{id, reason}]
 * per row — drives an honest "N of M, reason breakdown" toast, mirroring the
 * candidate stage-bulk pattern (useCandidateStageBulk's reasonBreakdown).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { notify as notifyTyped, notifyError } from '@/lib/notify'
// Local loose-typed wrapper: mirrors useCandidateBulkActions' `notify` prop —
// a partial-result toast is a 'warning', a type the shared lib's strict
// ToastType ('error'|'success'|'info') doesn't carry yet.
const notify = notifyTyped as unknown as (type: string, message: string) => void
import { bucketOfPhase } from '../data/applicationsShared'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

interface Args {
  // The current rows — bulkSetPhase/bulkDetach snapshot the fields they overwrite so
  // any id the server skips can be reverted individually (rows may start from
  // different states).
  applications: Application[]
  setApplications: Dispatch<SetStateAction<Application[]>>
  setTotal: Dispatch<SetStateAction<number>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  funnelTypes: LookupItem[]
  t: TFunction
}

// Server row-skip shape shared by every bulk route: [{ id, reason, code }].
interface SkippedRow { id: Id; reason?: string; code?: string }

export function useApplicationBulkActions({ applications, setApplications, setTotal, selectedIds, setSelectedIds, funnelTypes, t }: Args) {
  // Row-selection handlers for the table checkboxes + bulk bar.
  const toggleRow = (id: Id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const n = new Set(prev); ids.forEach(i => allSelected ? n.delete(i) : n.add(i)); return n })

  // Group reasoned skip rows into a human "N reason, M reason" string (mirrors
  // useCandidateStageBulk/useMatchesBulkActions reasonBreakdown) — falls back to ''
  // when the server sent bare ids or no reason at all.
  const reasonBreakdown = (skipped: SkippedRow[]): string => {
    const reasoned = skipped.filter((s): s is SkippedRow & { reason: string } => typeof s.reason === 'string' && s.reason.length > 0)
    if (!reasoned.length) return ''
    const counts: Record<string, number> = {}
    reasoned.forEach(s => { counts[s.reason] = (counts[s.reason] ?? 0) + 1 })
    return Object.entries(counts)
      .map(([reason, count]) => `${count} ${t(`bulk.skipReasons.${reason}`, { defaultValue: reason })}`)
      .join(', ')
  }

  // Normalize whatever `skipped` shape the response carries into SkippedRow[].
  const parseSkipped = (raw: unknown): SkippedRow[] => {
    if (!Array.isArray(raw)) return []
    return raw.map(row => (typeof row === 'object' && row !== null && 'id' in row)
      ? row as SkippedRow
      : { id: row as Id })
  }

  // Toast a bulk outcome: a full success keeps the descriptive success toast; any
  // skip switches to a warning with a "N of M, reason" breakdown when reasons are
  // present, or a bare "N of M" count otherwise. One shared rule for both actions.
  const notifyOutcome = (successKey: string, params: Record<string, unknown>, updated: number, total: number, skipped: SkippedRow[]) => {
    if (total > 0 && updated < total) {
      const breakdown = reasonBreakdown(skipped)
      const key = breakdown ? 'bulk.partialResultReasoned' : 'bulk.partialResult'
      notify('warning', t(key, { ...params, updated, total, skipped: total - updated, breakdown }))
    } else {
      notify('success', t(successKey, { ...params, count: updated }))
    }
  }

  // Bulk: move every selected application to one funnel phase via the real bulk
  // route. Optimistic write up front; the response's `updated` set drives the
  // per-row reconcile (a skipped row snaps back to its own pre-call phase/bucket).
  const bulkSetPhase = (phaseKey: string) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const before = new Map(applications
      .filter(a => a.id != null && selectedIds.has(a.id as Id))
      .map(a => [String(a.id), { phaseKey: a.phaseKey, bucket: a.bucket }]))
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, phaseKey, bucket: bucketOfPhase(phaseKey, funnelTypes) } : a))
    setSelectedIds(new Set())
    api.post('/applications/bulk/stage', { application_ids: ids, phase_key: phaseKey })
      .then(res => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated.map(String)) : new Set(ids.map(String))
        const skipped = parseSkipped(res.data?.skipped)
        setApplications(prev => prev.map(a => {
          if (a.id == null || !before.has(String(a.id)) || updated.has(String(a.id))) return a
          return { ...a, ...before.get(String(a.id))! }
        }))
        notifyOutcome('bulk.done', { value: phaseKey }, updated.size, ids.length, skipped)
      })
      .catch(() => {
        setApplications(prev => prev.map(a => {
          const snap = a.id != null ? before.get(String(a.id)) : undefined
          return snap ? { ...a, ...snap } : a
        }))
        notifyError(t('common:actionFailed'))
      })
  }

  // Bulk: detach (soft-delete) every selected application via the real bulk route.
  // Optimistic archive + total decrement up front; a skipped id (e.g. missing
  // permission on that row, already detached) reverts individually rather than
  // rolling back the whole batch.
  const bulkDetach = (reason: string) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, archived: true } : a))
    setTotal(prev => Math.max(0, prev - ids.length))
    setSelectedIds(new Set())
    api.post('/applications/bulk/detach', { application_ids: ids, reason })
      .then(res => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated.map(String)) : new Set(ids.map(String))
        const skipped = parseSkipped(res.data?.skipped)
        const revertedCount = ids.filter(id => !updated.has(String(id))).length
        if (revertedCount > 0) {
          setApplications(prev => prev.map(a => (a.id != null && ids.includes(a.id as Id) && !updated.has(String(a.id))) ? { ...a, archived: false } : a))
          setTotal(prev => prev + revertedCount)
        }
        notifyOutcome('bulk.done', {}, updated.size, ids.length, skipped)
      })
      .catch(() => {
        setApplications(prev => prev.map(a => a.id != null && ids.includes(a.id as Id) ? { ...a, archived: false } : a))
        setTotal(prev => prev + ids.length)
        notifyError(t('common:actionFailed'))
      })
  }

  return { toggleRow, toggleAll, bulkSetPhase, bulkDetach }
}
