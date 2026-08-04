/**
 * useMatchTerminate — MATCH-TERMINATE-1: ends one match via
 * POST /matches/{id}/terminate ({ stop_reason, effective_date, note? }). The
 * backend closes the match through the tenant's is_closed-flagged status and
 * returns the full updated match (same shape as GET /matches/{id}). The
 * response is mapped through the SAME mapMatch the list/detail fetch already
 * uses (useMatches) so the caller's onUpdate refreshes both the row and the
 * open drawer from one real persistence path — no bespoke re-fetch/mapping.
 * Errors are rethrown as-is so the modal can surface per-field 422 messages.
 */
import { useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { mapMatch } from './useMatches'
import type { MatchRow } from '@/types/match'

export interface MatchTerminatePayload {
  stop_reason: string
  effective_date: string
  note?: string
}

export function useMatchTerminate(
  matchId: MatchRow['id'] | undefined,
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void,
) {
  const [saving, setSaving] = useState(false)

  // POST the contract body; on success, map + hand the fresh row to the
  // caller's refresh path. Rethrows on failure — the caller owns the toast/
  // field-error surfacing (the modal keeps its own draft state open on 422).
  const terminate = async (payload: MatchTerminatePayload) => {
    if (matchId == null) return
    setSaving(true)
    try {
      const r = await api.post(`/matches/${matchId}/terminate`, payload)
      const updated = mapMatch(unwrap(r))
      onUpdate?.(matchId, updated)
      return updated
    } finally {
      setSaving(false)
    }
  }

  return { terminate, saving }
}
