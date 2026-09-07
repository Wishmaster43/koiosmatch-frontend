/**
 * geocodeLocation — the radius filter's place lookup goes through the backend
 * proxy (OPENCAGE-1): the axios client already carries /api, the route is
 * /geocode/search, country is optional (all countries), and a miss reads as null.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { geocodeLocation } from './geocode'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
afterEach(() => vi.clearAllMocks())

describe('geocodeLocation', () => {
  it('calls GET /geocode/search with q only (every country) and returns the hit', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { lat: 52.09, lng: 5.12, label: 'Utrecht' } } })
    const hit = await geocodeLocation('  Utrecht ')
    expect(api.get).toHaveBeenCalledWith('/geocode/search', { params: { q: 'Utrecht' } })
    expect(hit).toEqual({ lat: 52.09, lng: 5.12, label: 'Utrecht' })
  })

  it('passes an explicit country through', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { lat: 1, lng: 2, label: null } } })
    await geocodeLocation('Gent', 'BE')
    expect(api.get).toHaveBeenCalledWith('/geocode/search', { params: { q: 'Gent', country: 'BE' } })
  })

  it('a miss (404) and a provider problem (503) both read as null, an empty query never calls', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404 } })
    expect(await geocodeLocation('Nergenshuizen')).toBeNull()
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 503 } })
    expect(await geocodeLocation('Utrecht')).toBeNull()
    expect(await geocodeLocation('   ')).toBeNull()
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
