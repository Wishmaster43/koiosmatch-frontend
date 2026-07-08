/**
 * useOutreachDetail — loads one campaign (GET /outreach-campaigns/{id} includes
 * targets.candidate) and checks targets off optimistically (PATCH /outreach-targets/{id};
 * the backend stamps contacted_at). Four states for the drawer; reverts on failure.
 */
import { useState, useEffect, useCallback } from 'react'
import { getCampaign, updateTarget } from '../data/outreachApi'
import type { Campaign } from './useOutreachCampaigns'

export interface OutreachTarget {
  id: string
  status?: 'todo' | 'contacted' | 'answered' | 'skipped' | string
  // Call outcome (OUTREACH-2) — a slug from the /outreach-outcomes tenant lookup.
  outcome?: string | null
  note?: string | null
  contacted_at?: string | null
  // status/phase = deployability + lifecycle slugs (C-CHIP) for the shared CandidateStatusChip.
  candidate?: {
    id?: string; name?: string; first_name?: string; last_name?: string
    status?: string | null; phase?: string | null
  } | null
  [key: string]: unknown
}
export interface CampaignDetail extends Campaign { targets?: OutreachTarget[] }

export function useOutreachDetail(id: string | null) {
  const [detail,  setDetail]  = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  // Load the campaign + its targets whenever the drawer opens on a new id.
  useEffect(() => {
    if (!id) { setDetail(null); return }
    let alive = true
    setLoading(true); setError(false)
    getCampaign(id)
      .then(d => { if (alive) setDetail(d as CampaignDetail) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  // Check off / update one target — optimistic, revert on failure.
  const setTargetStatus = useCallback(async (targetId: string, status: string) => {
    let prev: OutreachTarget[] | undefined
    setDetail(d => {
      prev = d?.targets
      return d ? { ...d, targets: (d.targets ?? []).map(t => t.id === targetId ? { ...t, status } : t) } : d
    })
    try { await updateTarget(targetId, { status }) }
    catch { setDetail(d => (d && prev ? { ...d, targets: prev } : d)) }
  }, [])

  // Record the call OUTCOME for one target (OUTREACH-2) — optimistic, revert on failure
  // (the PATCH 422s until the backend ships the `outcome` column; the UI stays honest).
  const setTargetOutcome = useCallback(async (targetId: string, outcome: string | null) => {
    let prev: OutreachTarget[] | undefined
    setDetail(d => {
      prev = d?.targets
      return d ? { ...d, targets: (d.targets ?? []).map(t => t.id === targetId ? { ...t, outcome } : t) } : d
    })
    try { await updateTarget(targetId, { outcome }) }
    catch { setDetail(d => (d && prev ? { ...d, targets: prev } : d)) }
  }, [])

  return { detail, loading, error, setTargetStatus, setTargetOutcome }
}
