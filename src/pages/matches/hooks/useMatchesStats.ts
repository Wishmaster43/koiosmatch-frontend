/**
 * useMatchesStats — MATCH-APPROVAL-QUICKVIEW: the 'Te beoordelen' KPI tile reads
 * GET /matches/stats.pending_approval (MatchController::stats, aggregated over the
 * SAME MatchQuery-filtered base the list uses) instead of counting the already-
 * loaded rows client-side. Deliberately never sends `approval_status` itself — the
 * tile must keep showing the true pending count regardless of whether the quick
 * view toggle that narrows the TABLE is on, or the number would collapse to "all
 * visible rows" the moment someone turns the toggle on. `includeArchived` mirrors
 * the same flag useMatches sends so both describe the same archived-state population.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { MatchStats } from '@/types/match'

// `refreshTick` lets the caller force a refetch (e.g. after creating a match or
// an archive/restore) — mirrors useMatches' own refreshTick mechanism.
export function useMatchesStats(includeArchived: boolean = false, refreshTick: number = 0) {
  const [pendingApproval, setPendingApproval] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    const params: Record<string, unknown> = {}
    if (includeArchived) params.include_archived = 1
    api.get('/matches/stats', { params })
      .then(r => { if (alive) setPendingApproval((r.data as MatchStats | undefined)?.pending_approval ?? 0) })
      // §3: a missing/erroring endpoint stays null (the house dash), never a
      // fabricated zero that reads as "nothing to review".
      .catch(err => { if (alive) { setPendingApproval(null); setError(err) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [includeArchived, refreshTick])

  return { pendingApproval, loading, error }
}
