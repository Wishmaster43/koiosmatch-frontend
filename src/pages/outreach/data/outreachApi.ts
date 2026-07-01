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
export const createCampaign = (body: Record<string, unknown>) =>
  api.post('/outreach-campaigns', body).then((r) => r.data)

// Update campaign fields (name / status / …).
export const updateCampaign = (id: string, body: Record<string, unknown>) =>
  api.patch(`/outreach-campaigns/${id}`, body).then(unwrap)

// Soft-delete (archive) a campaign.
export const deleteCampaign = (id: string) => api.delete(`/outreach-campaigns/${id}`)

// (Re)fill targets from a pool; idempotent on the backend.
export const generateTargets = (id: string, poolId?: string) =>
  api.post(`/outreach-campaigns/${id}/generate`, poolId ? { pool_id: poolId } : {}).then((r) => r.data)

// Target-status distribution for a campaign (todo / contacted / skipped / answered).
export const getCampaignStats = (id: string) => api.get(`/outreach-campaigns/${id}/stats`).then(unwrap)

// Check off / update a single target (status + note); backend stamps contacted_at.
export const updateTarget = (id: string, body: Record<string, unknown>) =>
  api.patch(`/outreach-targets/${id}`, body).then(unwrap)
