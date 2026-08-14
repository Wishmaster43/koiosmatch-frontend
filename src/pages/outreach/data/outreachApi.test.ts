/**
 * outreachApi — verifies each wrapper hits the exact per-id route/method the
 * backend declares (routes/api/tenant/tasks-outreach.php), so a routing typo fails
 * fast instead of surfacing as a silent 404. Enkelstuks-sweep (BE 9170e40): the
 * archive/restore pair is per-GUID — DELETE /{id} + POST /{id}/restore.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import { listCampaigns, createCampaign, deleteCampaign, restoreCampaign, updateCampaign, getCampaignStats, assignTargets } from './outreachApi'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('outreachApi', () => {
  // OUTREACH-TRASHED-1 fixed (W2 delivered, measured): `archived=1` is now a true
  // onlyTrashed filter server-side (mirrors tasks) — the page uses it directly.
  it('listCampaigns passes params through to GET /outreach-campaigns (archived=1 onlyTrashed wiring)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    await listCampaigns({ archived: 1 })
    expect(api.get).toHaveBeenCalledWith('/outreach-campaigns', { params: { archived: 1 } })
  })

  // DD-FE-3 (P8, measured 08-08): createCampaign must mirror getCampaign and hand
  // the caller the unwrapped record (OutreachCreate → useOutreachCampaigns.add
  // prepends this straight into the list) — not the raw {data:{...}} envelope,
  // which previously produced a corrupted row and broke the new list's drilldown.
  it('createCampaign POSTs the body and returns the unwrapped record, not the envelope', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'abc-123', name: 'Bellijst' } } })
    const result = await createCampaign({ name: 'Bellijst', channel: 'call' })
    expect(api.post).toHaveBeenCalledWith('/outreach-campaigns', { name: 'Bellijst', channel: 'call' })
    expect(result).toEqual({ id: 'abc-123', name: 'Bellijst' })
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

  // G31: getCampaignStats existed but was never called from the FE — pin the exact
  // route + the AbortSignal pass-through the entity-keyed stats hook relies on.
  it('getCampaignStats GETs /outreach-campaigns/{id}/stats and unwraps the body', async () => {
    const signal = new AbortController().signal
    vi.mocked(api.get).mockResolvedValue({ data: { total: 3, by_status: [], by_outcome: [], by_assignee: [] } })
    const result = await getCampaignStats('abc-123', { signal })
    expect(api.get).toHaveBeenCalledWith('/outreach-campaigns/abc-123/stats', { signal })
    expect(result).toEqual({ total: 3, by_status: [], by_outcome: [], by_assignee: [] })
  })

  // BELLIJST-ASSIGN-2: pins the ids/filters XOR + the person/team/role axes the
  // backend's new contract validates, and that the RAW {data, meta} envelope
  // survives untouched (the caller needs both the fresh campaign and the summary).
  it('assignTargets POSTs an ids-selection + assignee_id and returns the raw {data, meta} envelope', async () => {
    const body = { ids: ['t1', 't2'], assignee_id: 'r1' }
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { id: 'abc-123' }, meta: { updated: ['t1', 't2'], skipped: [] } },
    })
    const result = await assignTargets('abc-123', body)
    expect(api.post).toHaveBeenCalledWith('/outreach-campaigns/abc-123/targets/assign', body)
    expect(result).toEqual({ data: { id: 'abc-123' }, meta: { updated: ['t1', 't2'], skipped: [] } })
  })

  it('assignTargets POSTs a filters-selection + role axes, never mixed with ids', async () => {
    const body = { filters: { status: 'todo' }, assignee_role_id: 7, assignee_role_mode: 'all' as const }
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'abc-123' }, meta: { updated: ['t1'], skipped: [] } } })
    await assignTargets('abc-123', body)
    expect(api.post).toHaveBeenCalledWith('/outreach-campaigns/abc-123/targets/assign', body)
    const sent = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(sent).not.toHaveProperty('ids')
  })
})
