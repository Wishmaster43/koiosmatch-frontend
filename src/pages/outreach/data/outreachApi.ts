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

// BELLIJST-ASSIGN-1 (G29): divide selected targets over the chosen recruiters
// round-robin. Returns the RAW envelope (not unwrapped) — the caller needs both
// the fresh campaign `data` (targets carry their new assignee) and the
// `meta.updated`/`meta.skipped` id lists for an honest result summary.
export const assignTargets = (id: string, body: { target_ids: string[]; recruiter_ids: string[] }) =>
  api.post(`/outreach-campaigns/${id}/targets/assign`, body).then((r) => r.data)
