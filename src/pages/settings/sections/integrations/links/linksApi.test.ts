/**
 * linksApi — REQUEST-ASSERT-1: method, route and params/body on the mocked client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import api from '@/lib/api'
import { listLinks, putLink } from './linksApi'

// Keep the real unwrapList; only the default axios client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPut = api.put as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { mockGet.mockReset(); mockPut.mockReset() })

describe('listLinks', () => {
  // All filters travel as the contract names them, the type list as an array.
  it('GETs /integrations/links with entity_type[], system, status, search, page and per_page', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ entity_type: 'candidate', entity_id: 'c1' }], meta: { current_page: 2, last_page: 3, per_page: 50, total: 120 } } })
    const res = await listLinks({ system: 'helloflex', entityTypes: ['candidate', 'customer'], status: 'failed', search: 'ada', page: 2, perPage: 50 })
    expect(mockGet).toHaveBeenCalledWith('/integrations/links', expect.objectContaining({
      params: { system: 'helloflex', entity_type: ['candidate', 'customer'], status: 'failed', search: 'ada', page: 2, per_page: 50 },
    }))
    expect(res).toMatchObject({ total: 120, page: 2, lastPage: 3, perPage: 50 })
    expect(res.rows).toHaveLength(1)
  })

  // The wire form is the bracket array and the search is cut at the 100-char contract cap.
  it('serialises entity_type as entity_type[]= pairs and slices search to 100 chars', async () => {
    mockGet.mockResolvedValue({ data: { data: [], meta: {} } })
    await listLinks({ system: 'helloflex', entityTypes: ['candidate', 'customer'], search: 'x'.repeat(150) })
    const params = mockGet.mock.calls[0][1].params
    expect(params.search).toHaveLength(100)
    const uri = decodeURIComponent(axios.getUri({ url: '/integrations/links', params }))
    expect(uri).toContain('entity_type[]=candidate&entity_type[]=customer')
  })

  // Empty filters are omitted so an unknown or blank param never reaches the server.
  it('omits empty filters', async () => {
    mockGet.mockResolvedValue({ data: { data: [], meta: {} } })
    await listLinks({ system: 'shiftmanager', entityTypes: [], search: '' })
    expect(mockGet.mock.calls[0][1].params).toEqual({ system: 'shiftmanager' })
  })
})

describe('putLink', () => {
  // HelloFlex uses hf_id.
  it('PUTs hf_id for helloflex', async () => {
    mockPut.mockResolvedValue({ data: {} })
    await putLink({ entity_type: 'candidate', entity_id: 'c1', system: 'helloflex', external_id: 'HF-1' })
    expect(mockPut).toHaveBeenCalledWith('/external-id-mappings', { entity_type: 'candidate', entity_id: 'c1', hf_id: 'HF-1' })
  })

  // Shiftmanager uses sm_id.
  it('PUTs sm_id for shiftmanager', async () => {
    mockPut.mockResolvedValue({ data: {} })
    await putLink({ entity_type: 'customer', entity_id: 'k1', system: 'shiftmanager', external_id: 'SM-9' })
    expect(mockPut).toHaveBeenCalledWith('/external-id-mappings', { entity_type: 'customer', entity_id: 'k1', sm_id: 'SM-9' })
  })

  // null clears the link.
  it('sends null to clear the link', async () => {
    mockPut.mockResolvedValue({ data: {} })
    await putLink({ entity_type: 'match', entity_id: 'm1', system: 'helloflex', external_id: null })
    expect(mockPut).toHaveBeenCalledWith('/external-id-mappings', { entity_type: 'match', entity_id: 'm1', hf_id: null })
  })
})
