/**
 * useOutreachStats — the campaign's target-status / outcome / assignee counts
 * (G31: GET /outreach-campaigns/{id}/stats was live on the backend but never
 * fetched from the FE). Entity-keyed load with an AbortController (§9) — the
 * Stats tab only mounts while active (DrawerTabs renders one tab at a time), so
 * this effectively fetches on open, mirroring useOutreachActivity.
 */
import { useState, useEffect } from 'react'
import { getCampaignStats } from '../data/outreachApi'
import type { Id } from '@/types/common'

// The shape OutreachCampaignController::stats() returns (measured). by_status/
// by_outcome are projected over EVERY tenant lookup value (incl. zero counts);
// by_assignee is the shared ownerDistribution() shape (owner_id/name/count).
export interface CampaignStats {
  total: number
  by_status: Array<{ status: string; count: number }>
  by_outcome: Array<{ outcome: string; count: number }>
  by_assignee: Array<{ owner_id: string | null; name: string; count: number }>
}

export function useOutreachStats(campaignId?: Id | null) {
  const [stats,   setStats]   = useState<CampaignStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!campaignId) { setStats(null); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    getCampaignStats(String(campaignId), { signal: ctrl.signal })
      .then((res) => setStats(res as CampaignStats))
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED') return
        // A 404 (stale/hard-deleted campaign id) reads as "no data" rather than a
        // failure, mirroring useOutreachActivity's 404 handling.
        if (err?.response?.status !== 404) setError(true)
        setStats(null)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [campaignId])

  return { stats, loading, error }
}
