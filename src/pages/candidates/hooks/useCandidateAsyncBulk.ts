/**
 * useCandidateAsyncBulk — the "queued, not done" bulk cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): both actions
 * here fire a queued/async backend job (202-style) with no optimistic row
 * patch and no `updated`-list reconcile — mirrors why useCandidateStageBulk
 * was split out earlier. Kept together because they share that exact shape:
 * `bulkGeocode` (GEO-REGEOCODE-1, PDOK re-geocode) and `bulkCoupleBackoffice`
 * (SYNC-BULK-1, HelloFlex/Shiftmanager coupling — the bulk path of the three
 * §3B linking paths: manual/bulk/workflow).
 */
import api, { isServiceUnavailable } from '@/lib/api'
import type { TFunction } from 'i18next'
import type { Dispatch, SetStateAction } from 'react'
import type { Id } from '@/types/common'

interface UseCandidateAsyncBulkParams {
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
}

export function useCandidateAsyncBulk({ selectedIds, setSelectedIds, notify, t }: UseCandidateAsyncBulkParams) {
  // GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" for the selection. The endpoint
  // is queued + rate-limited (202) — no optimistic row patch, no reconcile against
  // an `updated` list, just fire the bulk POST and say "started" (never "done";
  // the coordinates land later via the async worker, same honesty as the per-id button).
  const bulkGeocode = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setSelectedIds(new Set())
    api.post('/candidates/bulk/geocode', { candidate_ids: ids })
      .then(() => notify('success', t('common:geocode.started')))
      .catch(() => notify('error', t('bulk.mutateError')))
  }

  // SYNC-BULK-1 (§3B — bulk is the 3rd of the three backoffice-coupling paths;
  // manual is BackofficeLinksTab, workflow is a module). Shares the ONE generic
  // POST /sync/{entity}/bulk endpoint the per-record tab already uses. That
  // endpoint returns { queued, skipped } — NOT the `updated`/`skipped` shape
  // bulkMutate reconciles on — so this is a small dedicated adapter rather than a
  // bulkMutate call: nothing on the row changes visibly on QUEUE (mirrors
  // bulkGeocode — no optimistic patch, no revert needed), and the toast stays
  // honest: "queued", never "done", plus the skipped count so a matrix block or
  // an unknown/other-tenant id is never silently swallowed (BackofficeSyncController::bulk).
  const bulkCoupleBackoffice = (system: 'helloflex' | 'shiftmanager') => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setSelectedIds(new Set())
    const targetLabel = t(`common:backofficeLinks.${system}.name`)
    api.post('/sync/candidates/bulk', { ids, system })
      .then((res) => {
        const queued = Array.isArray(res.data?.queued) ? res.data.queued.length : 0
        const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped.length : 0
        if (skipped > 0) notify('warning', t('bulk.coupleQueuedPartial', { target: targetLabel, queued, total: queued + skipped, skipped }))
        else notify('success', t('bulk.coupleQueued', { target: targetLabel, count: queued }))
      })
      .catch((err) => {
        // 404 (route not yet deployed) and 503 (module not configured for this
        // tenant) both read as "not available right now", never a hard error.
        if (err?.response?.status === 404 || isServiceUnavailable(err)) notify('info', t('bulk.coupleUnavailable'))
        else notify('error', t('bulk.mutateError'))
      })
  }

  return { bulkGeocode, bulkCoupleBackoffice }
}
