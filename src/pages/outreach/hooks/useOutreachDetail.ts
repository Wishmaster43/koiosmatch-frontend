/**
 * useOutreachDetail — loads one campaign (GET /outreach-campaigns/{id} includes
 * targets.candidate) and checks targets off optimistically (PATCH /outreach-targets/{id};
 * the backend stamps contacted_at). Also patches the campaign's own owner (PATCH
 * /outreach-campaigns/{id} — UpdateOutreachCampaignRequest accepts owner_id, measured
 * in app/Http/Requests/Outreach). Four states for the drawer; reverts on failure.
 *
 * BELLIJST-NOTE-POPOUT-1: `applyTargetNote` is the ONE exception to "every setter
 * here calls the API" — it adopts a note already persisted by the target note's
 * second-screen window (its own standalone PATCH), local state only.
 */
import { useState, useEffect, useCallback } from 'react'
import { getCampaign, updateCampaign, updateTarget, assignTargets as assignTargetsApi } from '../data/outreachApi'
import type { Campaign } from './useOutreachCampaigns'
import type { TargetSelection, AssigneeAxes } from '../data/outreachApi'

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
  // BELLIJST-ASSIGN-1 (G29): the recruiter this target got round-robin assigned to
  // (OutreachTargetResource `assignee`, central users row, may be null).
  assignee?: { id?: string; name?: string } | null
  [key: string]: unknown
}

// The { updated, skipped } id lists assignTargets() reports back (§13 — an honest
// result summary, never a bare "done").
export interface AssignResult { updated: string[]; skipped: string[] }
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

  // Save a target's per-candidate note (G30, max:2000 plain string on the backend —
  // no rich-text storage, so no optimistic-revert is needed beyond the same pattern
  // as the other target setters). Optimistic, revert on failure.
  const setTargetNote = useCallback(async (targetId: string, note: string) => {
    let prev: OutreachTarget[] | undefined
    setDetail(d => {
      prev = d?.targets
      return d ? { ...d, targets: (d.targets ?? []).map(t => t.id === targetId ? { ...t, note } : t) } : d
    })
    try { await updateTarget(targetId, { note }) }
    catch (err) { setDetail(d => (d && prev ? { ...d, targets: prev } : d)); throw err }
  }, [])

  // BELLIJST-ASSIGN-2: assign the given selection (manual `ids` OR a `filters`
  // set that reaches beyond the loaded page, never both) to one person, team or
  // role. No optimistic guess at the result (the backend owns which rows match a
  // `filters` selection) — the fresh campaign detail from the response replaces
  // state once the request settles; the caller shows the { updated, skipped }
  // summary. Throws on failure so the caller can notify.
  const assignTargets = useCallback(async (selection: TargetSelection, assignee: AssigneeAxes): Promise<AssignResult> => {
    if (!id) return { updated: [], skipped: [] }
    const res = await assignTargetsApi(id, { ...selection, ...assignee }) as
      { data?: CampaignDetail; meta?: AssignResult }
    if (res?.data) setDetail(res.data)
    return res?.meta ?? { updated: [], skipped: [] }
  }, [id])

  // BELLIJST-NOTE-POPOUT-1: adopt a note the POP-OUT WINDOW already persisted on
  // its own standalone PATCH (OutreachTargetNotePopout) — local state only, no
  // second PATCH here (that would double-write). Without this, collapsing then
  // re-expanding a target row (TargetsTab unmounts TargetNoteField on collapse)
  // would read this hook's now-stale `detail.targets`, not the popout's save.
  const applyTargetNote = useCallback((targetId: string, note: string) => {
    setDetail(d => (d ? { ...d, targets: (d.targets ?? []).map(t => t.id === targetId ? { ...t, note } : t) } : d))
  }, [])

  // Change the campaign's owner — optimistic, revert on failure (mirrors setTargetStatus).
  const setOwner = useCallback(async (campaignId: string, owner: { id: string; name: string } | null) => {
    let prev: CampaignDetail['owner'] | undefined
    setDetail(d => {
      prev = d?.owner
      return d ? { ...d, owner } : d
    })
    try { await updateCampaign(campaignId, { owner_id: owner?.id ?? null }) }
    catch { setDetail(d => (d ? { ...d, owner: prev ?? null } : d)) }
  }, [])

  // Save the Extra tab's tenant custom fields (§3B) — optimistic, merges the partial
  // patch into the full map so the backend persists it whole; reverts on failure.
  const setCustomFields = useCallback(async (campaignId: string, patch: Record<string, unknown>) => {
    let prev: Record<string, unknown> | undefined
    const merged = { ...(detail?.custom_fields ?? {}), ...patch }
    setDetail(d => {
      prev = d?.custom_fields
      return d ? { ...d, custom_fields: merged } : d
    })
    try { await updateCampaign(campaignId, { custom_fields: merged }) }
    catch { setDetail(d => (d ? { ...d, custom_fields: prev } : d)) }
  }, [detail])

  return { detail, loading, error, setTargetStatus, setTargetOutcome, setTargetNote, applyTargetNote, assignTargets, setOwner, setCustomFields }
}
