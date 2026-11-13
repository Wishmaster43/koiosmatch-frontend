/**
 * webhooksApi (WEBHOOK-LOG-FE-1 addition) — verifies listWebhookRequests and
 * getWebhookRequest hit the exact route/params the backend controller declares
 * (K-117), mirroring jobsApi.test.js's convention for this file's own siblings.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import {
  listWebhookRequests, getWebhookRequest,
  listInboundWebhooks, createInboundWebhook, updateInboundWebhook, deleteInboundWebhook, regenerateInboundSecret,
} from './webhooksApi'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('webhooksApi — inbound request log', () => {
  it('listWebhookRequests reads GET /webhooks/{id}/requests with page + per_page', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], meta: { current_page: 2, last_page: 3, per_page: 25, total: 60 } } })
    const result = await listWebhookRequests('wh-1', 2, 25)
    expect(api.get).toHaveBeenCalledWith('/webhooks/wh-1/requests', { params: { page: 2, per_page: 25 } })
    // N010-PAGINATION-META-A: unwrapList also carries the server range; this mock meta has none → null.
    expect(result).toEqual({ rows: [], total: 60, page: 2, lastPage: 3, perPage: 25, from: null, to: null })
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

describe('webhooksApi - inbound webhooks adapter', () => {
  it('listInboundWebhooks reads GET /webhooks and returns the rows', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'wh-1', name: 'A', token: 't' }] })
    const result = await listInboundWebhooks()
    expect(api.get).toHaveBeenCalledWith('/webhooks')
    expect(result.rows).toEqual([{ id: 'wh-1', name: 'A', token: 't' }])
  })

  it('createInboundWebhook POSTs /webhooks with the body and unwraps the created row', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'wh-2', signing_secret: 's3cret' } })
    const created = await createInboundWebhook({ name: 'N', description: null })
    expect(api.post).toHaveBeenCalledWith('/webhooks', { name: 'N', description: null })
    expect(created).toMatchObject({ id: 'wh-2', signing_secret: 's3cret' })
  })

  it('updateInboundWebhook PATCHes /webhooks/{id} with name and description', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    await updateInboundWebhook('wh-1', { name: 'N2', description: 'D' })
    expect(api.patch).toHaveBeenCalledWith('/webhooks/wh-1', { name: 'N2', description: 'D' })
  })

  it('deleteInboundWebhook DELETEs /webhooks/{id}', async () => {
    vi.mocked(api.delete).mockResolvedValue({})
    await deleteInboundWebhook('wh-1')
    expect(api.delete).toHaveBeenCalledWith('/webhooks/wh-1')
  })

  it('regenerateInboundSecret POSTs the recovery route without a body and with an idempotency key header', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { signing_secret: 'fresh' } })
    const row = await regenerateInboundSecret('wh-1')
    const [route, body, config] = vi.mocked(api.post).mock.calls[0]
    expect(route).toBe('/webhooks/wh-1/regenerate-secret')
    expect(body).toBeUndefined()
    expect(Object.keys(config.headers).map((k) => k.toLowerCase())).toContain('idempotency-key')
    expect(row).toMatchObject({ signing_secret: 'fresh' })
  })
})
