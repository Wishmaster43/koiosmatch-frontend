/**
 * useMatchRenew — G04/MATCH-RENEWAL-1: extends a Match's end_date via
 * POST /matches/{id}/renew ({ new_end_date }). The backend (MatchRenewalService)
 * records the step in the match's renewal chain, pushes the match's own
 * end_date forward, and returns the full updated match (same shape as
 * GET /matches/{id}) — see MatchController::renew, which finishes with
 * `return $this->show($model->id)`. Mirrors useMatchTerminate exactly: the
 * response is mapped through the SAME mapMatch the list/detail fetch already
 * uses (useMatches), so the caller's onUpdate refreshes both the row and the
 * open drawer from one real persistence path. Errors are rethrown as-is so
 * the modal can surface the server's 422 field error (`new_end_date`).
 */
import { useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { mapMatch } from './useMatches'
import type { MatchRow } from '@/types/match'

export interface MatchRenewPayload {
  new_end_date: string
}

export function useMatchRenew(
  matchId: MatchRow['id'] | undefined,
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void,
) {
  const [saving, setSaving] = useState(false)

  // POST the contract body; on success, map + hand the fresh row to the
  // caller's refresh path. Rethrows on failure — the caller owns the toast/
  // field-error surfacing (the modal keeps its own draft state open on 422).
  const renew = async (payload: MatchRenewPayload) => {
    if (matchId == null) return
    setSaving(true)
    try {
      const r = await api.post(`/matches/${matchId}/renew`, payload)
      const updated = mapMatch(unwrap(r))
      onUpdate?.(matchId, updated)
      return updated
    } finally {
      setSaving(false)
    }
  }

  return { renew, saving }
}
