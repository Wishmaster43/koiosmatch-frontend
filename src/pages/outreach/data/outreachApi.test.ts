/**
 * outreachApi — verifies each wrapper hits the exact per-id route/method the
 * backend declares (routes/api/tenant/tasks-outreach.php), so a routing typo fails
 * fast instead of surfacing as a silent 404. Enkelstuks-sweep (BE 9170e40): the
 * archive/restore pair is per-GUID — DELETE /{id} + POST /{id}/restore.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import { listCampaigns, deleteCampaign, restoreCampaign, updateCampaign } from './outreachApi'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('outreachApi', () => {
  it('listCampaigns passes params through to GET /outreach-campaigns (include_archived wiring)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    await listCampaigns({ include_archived: 1 })
    expect(api.get).toHaveBeenCalledWith('/outreach-campaigns', { params: { include_archived: 1 } })
  })

  it('deleteCampaign sends the per-id DELETE /outreach-campaigns/{id}', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: null })
    await deleteCampaign('abc-123')
    expect(api.delete).toHaveBeenCalledWith('/outreach-campaigns/abc-123')
  })

  it('restoreCampaign sends POST /outreach-campaigns/{id}/restore and unwraps the detail', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'abc-123', name: 'Bellijst' } } })
    const result = await restoreCampaign('abc-123')
    expect(api.post).toHaveBeenCalledWith('/outreach-campaigns/abc-123/restore')
    expect(result).toEqual({ id: 'abc-123', name: 'Bellijst' })
  })

  it('updateCampaign sends the per-id PATCH /outreach-campaigns/{id}', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: 'abc-123' } } })
    await updateCampaign('abc-123', { status: 'done' })
    expect(api.patch).toHaveBeenCalledWith('/outreach-campaigns/abc-123', { status: 'done' })
  })
})
