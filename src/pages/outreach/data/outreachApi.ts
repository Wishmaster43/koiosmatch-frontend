/**
 * outreachApi — all axios calls for the outreach (call lists / campaigns) feature
 * in one place (CLAUDE §10). Responses are normalised through the shared
 * unwrap/unwrapList adapters so call sites get a stable shape.
 */
import api, { unwrap, unwrapList } from '@/lib/api'

// List campaigns for the active tenant (server-side filter + pagination).
export const listCampaigns = (params?: Record<string, unknown>) =>
  api.get('/outreach-campaigns', { params }).then(unwrapList)

// Full campaign detail.
export const getCampaign = (id: string) => api.get(`/outreach-campaigns/${id}`).then(unwrap)

// Create a campaign; `from_pool_id` seeds its targets from that talent pool.
// DD-FE-3 (P8, measured 08-08): mirrors getCampaign — the backend's `store()`
// returns the same wrapped OutreachCampaignResource as `show()`, so callers
// (OutreachCreate → useOutreachCampaigns.add) need the unwrapped record, not
// the raw {data:{...}} envelope. Returning the envelope silently corrupted the
// prepended list row (undefined id/name) and broke the new call list's drilldown.
export const createCampaign = (body: Record<string, unknown>) =>
  api.post('/outreach-campaigns', body).then(unwrap)

// Update campaign fields (name / status / …).
export const updateCampaign = (id: string, body: Record<string, unknown>) =>
  api.patch(`/outreach-campaigns/${id}`, body).then(unwrap)

// Soft-delete (archive) a campaign — per-id route (enkelstuks-sweep: there is no
// outreach bulk route; the bulk bar fans out over this one).
export const deleteCampaign = (id: string) => api.delete(`/outreach-campaigns/${id}`)

// Un-archive a campaign (enkelstuks-sweep, BE 9170e40: POST /outreach-campaigns/
// {id}/restore, gated outreach.update). Returns the fresh campaign detail.
export const restoreCampaign = (id: string) => api.post(`/outreach-campaigns/${id}/restore`).then(unwrap)

// (Re)fill targets from a pool; idempotent on the backend. Intentionally NOT
// unwrapped (mirrors assignTargets below) — the backend returns the fresh
// campaign `data` plus `meta.added` (how many targets got created), and a
// future caller needs both, not just the record.
export const generateTargets = (id: string, poolId?: string) =>
  api.post(`/outreach-campaigns/${id}/generate`, poolId ? { pool_id: poolId } : {}).then((r) => r.data)

// Target-status/outcome/assignee distribution for a campaign (G31). Accepts an
// optional AbortSignal so an entity-keyed load effect can cancel a stale request.
export const getCampaignStats = (id: string, opts?: { signal?: AbortSignal }) =>
  api.get(`/outreach-campaigns/${id}/stats`, opts).then(unwrap)

// Check off / update a single target (status + outcome + note); backend stamps contacted_at.
export const updateTarget = (id: string, body: Record<string, unknown>) =>
  api.patch(`/outreach-targets/${id}`, body).then(unwrap)

// BELLIJST-ASSIGN-2 (2026-08-14): the backend's spec export lags this contract
// (house rule §10 para 10 — hand-typed here, not from api-generated.ts), so the
// shapes below are copied LITERALLY from what backend-Claude delivered today.
//
// The selection is an XOR — either `ids` (a manual multi-select of target rows)
// or `filters` (the "everything matching the current search/filter, including
// rows the drilldown never loaded") — never both, never neither (the backend
// 422s on either violation). The assignment axes mirror the task assignee model
// 1:1: a person (`assignee_id`, uuid), a team (`assignee_team_id`, uuid) or a
// role (`assignee_role_id`, a BIGINT — NOT a uuid — + `assignee_role_mode`:
// 'all' hands the pick to every user in that role, 'one' to a single member the
// backend itself picks). Exactly one of the three axes is set per call.
export type TargetSelection = { ids: string[] } | { filters: Record<string, unknown> }
export interface AssigneeAxes {
  assignee_id?: string | null
  assignee_team_id?: string | null
  assignee_role_id?: number | null
  assignee_role_mode?: 'all' | 'one' | null
}
export type TargetsAssignBody = TargetSelection & AssigneeAxes

// Divide selected/filtered targets over a person, team or role. Returns the RAW
// envelope (not unwrapped) — the caller needs both the fresh campaign `data`
// (targets carry their new assignee) and the `meta.updated`/`meta.skipped` id
// lists for an honest result summary.
export const assignTargets = (id: string, body: TargetsAssignBody) =>
  api.post(`/outreach-campaigns/${id}/targets/assign`, body).then((r) => r.data)

// Same selection/axes contract, on the sibling `/targets/owner` route (backend
// delivered it alongside `/assign` today). Out of scope for the current
// divide-the-call-list UI (BELLIJST-ASSIGN-2 only wires `/assign`) — kept here so
// the exact contract is in one place and a future "set owner" affordance never
// re-derives the shape.
export const setTargetsOwner = (id: string, body: TargetsAssignBody) =>
  api.post(`/outreach-campaigns/${id}/targets/owner`, body).then((r) => r.data)
