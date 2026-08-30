/**
 * integrationsApi.test — proves the REQUEST shape (method/route/body/params)
 * per CLAUDE.md §13, mirroring CandidateSearchTab.test.tsx's api mock idiom:
 * unwrap/unwrapList stay real (importActual), only the default client is stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import {
  getIntegrations,
  getIntegrationSettings,
  putIntegrationSettings,
  testIntegration,
  listMappings,
  createMapping,
  updateMapping,
  deleteMapping,
} from './integrationsApi'

// Keep the real unwrap/unwrapList — only the default axios client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPut = api.put as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.delete as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGet.mockReset()
  mockPut.mockReset()
  mockPost.mockReset()
  mockDelete.mockReset()
})

describe('settings GET/PUT', () => {
  // GET returns the connector's shape unwrapped from { data: {...} }.
  it('GETs /integrations/{connector}/settings and unwraps the envelope', async () => {
    mockGet.mockResolvedValue({
      data: { data: { two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' } },
    })
    const result = await getIntegrationSettings('shiftmanager')
    expect(mockGet).toHaveBeenCalledWith('/integrations/shiftmanager/settings')
    expect(result).toEqual({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
  })

  // PUT passes the given shape through untouched — no field invention/stripping.
  it('PUTs the exact body given, including a write-only secret field', async () => {
    const body = {
      two_way: false,
      base_url: 'https://sm2.example',
      has_api_key: true,
      connected_as: null,
      api_key: 'super-secret',
    }
    // Snapshot BEFORE the call: comparing against the same reference would let a
    // mutating client pass (verify finding) — the clone fails on any drift.
    const expected = structuredClone(body)
    mockPut.mockResolvedValue({ data: { data: { ...body, api_key: undefined } } })
    await putIntegrationSettings('shiftmanager', body)
    expect(mockPut).toHaveBeenCalledWith('/integrations/shiftmanager/settings', expected)
    expect(mockPut.mock.calls[0][1]).toStrictEqual(expected)
  })

  // Omitting the secret field entirely must not be invented by the client.
  it('does not invent an api_key field when the caller omits it', async () => {
    const body = { two_way: true, base_url: null, has_api_key: false, connected_as: null }
    mockPut.mockResolvedValue({ data: { data: body } })
    await putIntegrationSettings('shiftmanager', body)
    const sentBody = mockPut.mock.calls[0][1] as Record<string, unknown>
    expect('api_key' in sentBody).toBe(false)
  })

  // Explicit null clears the secret — must be sent, not stripped.
  it('sends an explicit null secret to clear it', async () => {
    const body = { two_way: true, environment: 'uat' as const, client_id: 'abc', has_client_secret: false, connected_as: null, client_secret: null }
    mockPut.mockResolvedValue({ data: { data: body } })
    await putIntegrationSettings('helloflex', body)
    const sentBody = mockPut.mock.calls[0][1] as Record<string, unknown>
    expect(sentBody.client_secret).toBeNull()
  })
})

describe('POST /integrations/{connector}/test', () => {
  // 200 success returns the ok:true body.
  it('POSTs the test route and returns the success body', async () => {
    mockPost.mockResolvedValue({ data: { data: { ok: true, connected_as: 'Bureau X', details: {} } } })
    const result = await testIntegration('helloflex')
    expect(mockPost).toHaveBeenCalledWith('/integrations/helloflex/test', undefined, { quietStatuses: [422] })
    expect(result).toEqual({ ok: true, connected_as: 'Bureau X', details: {} })
  })

  // 422 failure: the axios error is thrown as-is so callers read error.response.data.
  it('throws the axios error on 422 so callers read error.response.data', async () => {
    const axiosError = {
      isAxiosError: true,
      response: { status: 422, data: { ok: false, reason_code: 'auth_failed', message: 'Auth failed.', correlation_id: 'corr-1' } },
    }
    mockPost.mockRejectedValue(axiosError)
    await expect(testIntegration('werkzoeken')).rejects.toBe(axiosError)
  })
})

describe('mappings CRUD', () => {
  // GET with domain param, unwrapped list.
  it('GETs mappings with the domain query param', async () => {
    const rows = [{ id: '1', connector: 'helloflex', domain: 'cao', koios_value: 'A', external_value: 'B', is_default: false }]
    mockGet.mockResolvedValue({ data: { data: rows } })
    const result = await listMappings('helloflex', 'cao')
    expect(mockGet).toHaveBeenCalledWith('/integrations/helloflex/mappings', { params: { domain: 'cao' } })
    expect(result).toEqual(rows)
  })

  // POST body shape — exactly the four accepted fields.
  it('POSTs the exact create body', async () => {
    const body = { domain: 'cao', koios_value: 'K1', external_value: 'E1', is_default: true }
    mockPost.mockResolvedValue({ data: { data: { id: '2', connector: 'helloflex', ...body } } })
    await createMapping('helloflex', body)
    expect(mockPost).toHaveBeenCalledWith('/integrations/helloflex/mappings', body, { quietStatuses: [422] })
  })

  // PUT partial update — only the changed fields go in the body.
  it('PUTs a partial update body to the row route', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: '2', connector: 'helloflex', domain: 'cao', koios_value: 'K1', external_value: 'E2', is_default: true } } })
    await updateMapping('helloflex', '2', { external_value: 'E2' })
    expect(mockPut).toHaveBeenCalledWith('/integrations/helloflex/mappings/2', { external_value: 'E2' }, { quietStatuses: [422] })
  })

  // DELETE hits the row route with no body, resolves on 204.
  it('DELETEs the row route', async () => {
    mockDelete.mockResolvedValue({ data: null, status: 204 })
    await deleteMapping('helloflex', '2')
    expect(mockDelete).toHaveBeenCalledWith('/integrations/helloflex/mappings/2')
  })
})

describe('GET /integrations (connector list)', () => {
  // The summary list route + unwrapped rows (always served, enabled=false when off).
  it('GETs the list route and unwraps the rows', async () => {
    const rows = [{ connector: 'shiftmanager', enabled: false, configured: false, two_way: false, connected_as: null, last_sync_at: null, health: 'unknown' }]
    mockGet.mockResolvedValue({ data: { data: rows } })
    const result = await getIntegrations()
    expect(mockGet).toHaveBeenCalledWith('/integrations')
    expect(result).toEqual(rows)
  })
})

