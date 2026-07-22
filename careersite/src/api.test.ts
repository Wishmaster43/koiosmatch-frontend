import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchSite, fetchVacancies, fetchVacancy, applyToVacancy } from './api'

// Builds a minimal fetch Response stand-in — only the members parseJsonOrThrow
// actually reads (ok/status/json). Avoids depending on jsdom's (absent) Fetch API.
function mockJsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

// Asserts the actual REQUEST (method/URL/body) the client builds, never only that
// a promise resolved — a base-path or query-param rename must fail here, not silently
// 404 on the real tenant career site (CLAUDE.md §13: mutation/request tests assert the seam).
describe('api client — request construction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchSite hits GET {base}/public/{tenant}/site with no credentials', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({ tenant: 'acme', name: 'Acme', brand_color: null, logo_url: null, address: null }))
    await fetchSite('acme')
    expect(mockFetch).toHaveBeenCalledWith('http://koiosmatch-api.test/api/public/acme/site', { credentials: 'omit' })
  })

  it('fetchVacancies encodes page/per_page/city/hours as query params', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({ data: [], meta: {}, links: {} }))
    await fetchVacancies('acme', { page: 2, per_page: 12, city: 'Utrecht', hours: 24 })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://koiosmatch-api.test/api/public/acme/vacancies?page=2&per_page=12&city=Utrecht&hours=24',
      { credentials: 'omit' },
    )
  })

  it('fetchVacancies omits unset filters instead of sending empty query params', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({ data: [], meta: {}, links: {} }))
    await fetchVacancies('acme', { city: 'Utrecht' })
    expect(mockFetch).toHaveBeenCalledWith('http://koiosmatch-api.test/api/public/acme/vacancies?city=Utrecht', { credentials: 'omit' })
  })

  it('fetchVacancies with no params sends no query string at all', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({ data: [], meta: {}, links: {} }))
    await fetchVacancies('acme', {})
    expect(mockFetch).toHaveBeenCalledWith('http://koiosmatch-api.test/api/public/acme/vacancies', { credentials: 'omit' })
  })

  it('fetchVacancy hits GET {base}/public/{tenant}/vacancies/{ref}', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({}))
    await fetchVacancy('acme', 'REF-1')
    expect(mockFetch).toHaveBeenCalledWith('http://koiosmatch-api.test/api/public/acme/vacancies/REF-1', { credentials: 'omit' })
  })

  it('applyToVacancy POSTs a multipart body to {base}/public/{tenant}/vacancies/{ref}/apply', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({ status: 'applied', reference: 'APP-1' }, 201))
    await applyToVacancy('acme', 'REF-1', {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '0612345678',
      website: '',
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://koiosmatch-api.test/api/public/acme/vacancies/REF-1/apply')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('omit')
    expect(init?.body).toBeInstanceOf(FormData)
    const body = init?.body as FormData
    expect(body.get('first_name')).toBe('Jane')
    expect(body.get('website')).toBe('')
  })

  it('throws ApiError carrying the status, never the raw response body', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse('secret internal error trace', 500))
    await expect(fetchSite('acme')).rejects.toMatchObject({ status: 500 })
  })
})
