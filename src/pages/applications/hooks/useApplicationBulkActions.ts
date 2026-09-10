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
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { reasonBreakdown } from '@/lib/bulkSkipReasons'
import { notify as notifyTyped, notifyError } from '@/lib/notify'
// Local loose-typed wrapper: mirrors useCandidateBulkActions' `notify` prop —
// a partial-result toast is a 'warning', a type the shared lib's strict
// ToastType ('error'|'success'|'info') doesn't carry yet.
const notify = notifyTyped as unknown as (type: string, message: string) => void
import { bucketOfPhase } from '../data/applicationsShared'
import { useBulkSelectionToggles } from '@/hooks/useBulkSelectionToggles'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'
// The bulk-stage endpoint validates stage_id (uuid), not phase_key (contract audit
// ENT1-01) — LookupsContext's funnelTypes shape only carries the row's `value`
// (key), never its real id, so this hook resolves the key to the backend uuid
// itself via the one hook that DOES fetch the real id (its own doc comment names
// this exact gap).
import { useApplicationStages } from '@/hooks/useApplicationStages'
// Same real-vs-seed check useApplicationOwnerAndStage.ts already uses to filter
// stage options — while the lookup is still its seed, ids are SLUGS ('hired'),
// not uuids, and the server would 422 on those.
import { isUuid } from '@/lib/uuid'

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
  const { toggleRow, toggleAll } = useBulkSelectionToggles(setSelectedIds)

  // Real backend stage id per funnel key (ENT1-01) — the funnel picker itself
  // still deals in keys (bucket/label resolution, local optimistic state), only
  // the outgoing request needs the uuid.
  const { stages } = useApplicationStages()
  const stageIdByKey = useMemo(() => new Map(stages.map(s => [s.value, s.id])), [stages])

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
      const breakdown = reasonBreakdown(skipped, t)
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
    // The validator requires stage_id (uuid, exists:application_stages,id) and rejects
    // phase_key on this route (contract audit ENT1-01). While the stage lookup is
    // still its seed (or failed to load), useApplicationStages' ids ARE the slugs
    // ('hired') — a non-uuid stageId is a GUARANTEED 422, so bail out BEFORE the
    // optimistic write rather than moving rows and snapping them back on failure.
    const stageId = stageIdByKey.get(phaseKey)
    if (!isUuid(stageId)) { notifyError(t('common:actionFailed')); return }
    const before = new Map(applications
      .filter(a => a.id != null && selectedIds.has(a.id as Id))
      .map(a => [String(a.id), { phaseKey: a.phaseKey, bucket: a.bucket }]))
    setApplications(prev => prev.map(a => a.id != null && selectedIds.has(a.id as Id) ? { ...a, phaseKey, bucket: bucketOfPhase(phaseKey, funnelTypes) } : a))
    setSelectedIds(new Set())
    api.post('/applications/bulk/stage', { application_ids: ids, stage_id: stageId })
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
