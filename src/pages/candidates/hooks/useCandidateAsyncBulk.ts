/**
 * useCandidateAsyncBulk — the "queued, not done" bulk cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): both actions
 * here fire a queued/async backend job (202-style) with no optimistic row
 * patch and no `updated`-list reconcile — mirrors why useCandidateStageBulk
 * was split out earlier. Kept together because they share that exact shape:
 * `bulkGeocode` (GEO-REGEOCODE-1, PDOK re-geocode) and `bulkCoupleBackoffice`
 * (SYNC-BULK-1, HelloFlex/Shiftmanager coupling — the bulk path of the three
 * §3B linking paths: manual/bulk/workflow), the latter built on the shared
 * useBackofficeCoupleBulk (src/hooks/) now that customers/matches carry the
 * exact same action.
 */
import api from '@/lib/api'
import type { TFunction } from 'i18next'
import type { Dispatch, SetStateAction } from 'react'
import type { Id } from '@/types/common'
import type { Candidate } from '@/types/candidate'
import { useBackofficeCoupleBulk } from '@/hooks/useBackofficeCoupleBulk'

interface UseCandidateAsyncBulkParams {
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
  // Full loaded candidate rows, so bulkGeocode can filter to rows missing coordinates.
  candidates: Candidate[]
}

export function useCandidateAsyncBulk({ selectedIds, setSelectedIds, notify, t, candidates }: UseCandidateAsyncBulkParams) {
  // GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" for the selection. The endpoint
  // is queued + rate-limited (202) — no optimistic row patch, no reconcile against
  // an `updated` list, just fire the bulk POST and say "started" (never "done";
  // the coordinates land later via the async worker, same honesty as the per-id button).
  // 18-hygiene (2026-08-14): only rows that are actually missing coordinates are
  // sent — re-geocoding an already-located candidate wastes PDOK rate-limit budget.
  const bulkGeocode = () => {
    const byId = new Map(candidates.map(c => [c.id, c]))
    const ids = [...selectedIds].filter(id => {
      const c = byId.get(id)
      return !c || c.lat == null || c.lng == null
    })
    if (!ids.length) return
    setSelectedIds(new Set())
    api.post('/candidates/bulk/geocode', { candidate_ids: ids })
      .then(() => notify('success', t('common:geocode.started')))
      .catch(() => notify('error', t('bulk.mutateError')))
  }

  // SYNC-BULK-1 (§3B — bulk is the 3rd of the three backoffice-coupling paths;
  // manual is BackofficeLinksTab, workflow is a module). Built on the shared
  // useBackofficeCoupleBulk (see its file doc for the endpoint/toast contract) —
  // candidates' target-label lookup and 'warning' partial tone are its defaults.
  const bulkCoupleBackoffice = useBackofficeCoupleBulk({
    entity: 'candidates', selectedIds, setSelectedIds, notify, t,
    targetLabel: system => t(`common:backofficeLinks.${system}.name`),
  })

  return { bulkGeocode, bulkCoupleBackoffice }
}
