/**
 * webhooksApi (WEBHOOK-LOG-FE-1 addition) — verifies listWebhookRequests and
 * getWebhookRequest hit the exact route/params the backend controller declares
 * (K-117), mirroring jobsApi.test.js's convention for this file's own siblings.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import { listWebhookRequests, getWebhookRequest } from './webhooksApi'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('webhooksApi — inbound request log', () => {
  it('listWebhookRequests reads GET /webhooks/{id}/requests with page + per_page', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], meta: { current_page: 2, last_page: 3, per_page: 25, total: 60 } } })
    const result = await listWebhookRequests('wh-1', 2, 25)
    expect(api.get).toHaveBeenCalledWith('/webhooks/wh-1/requests', { params: { page: 2, per_page: 25 } })
    expect(result).toEqual({ rows: [], total: 60, page: 2, lastPage: 3, perPage: 25 })
  })

  it('listWebhookRequests defaults to page 1 / 50 per page', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 } } })
    await listWebhookRequests('wh-1')
    expect(api.get).toHaveBeenCalledWith('/webhooks/wh-1/requests', { params: { page: 1, per_page: 50 } })
  })

  it('getWebhookRequest reads GET /webhooks/{id}/requests/{requestId} and unwraps the record', async () => {
    const record = { id: 'req-1', method: 'POST', status_code: 200, headers: {}, query: {}, body: null, response_body: null }
    vi.mocked(api.get).mockResolvedValue({ data: { data: record } })
    const result = await getWebhookRequest('wh-1', 'req-1')
    expect(api.get).toHaveBeenCalledWith('/webhooks/wh-1/requests/req-1')
    expect(result).toEqual(record)
  })
})
