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

  // Formulier-v2: address/photo/remarks/experiences/educations join the multipart
  // body as Laravel-style nested keys — this is the ONE place the real (unmocked)
  // buildApplyFormData runs, since ApplyForm.test.tsx mocks applyToVacancy itself.
  it('applyToVacancy nests experiences/educations as Laravel array keys and includes address/photo/remarks', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({ status: 'applied', reference: 'APP-1' }, 201))
    const photo = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await applyToVacancy('acme', 'REF-1', {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '+310612345678',
      street: 'Kerkstraat',
      house_number: '12',
      postcode: '1234AB',
      city: 'Utrecht',
      photo,
      remarks: 'Een vraag',
      experiences: [
        { company: 'Acme Zorg', title: 'Verpleegkundige', location: '', start_date: '', end_date: '', responsibilities: '', achievements: '' },
      ],
      educations: [{ name: 'Diploma verpleegkunde', organisation: '', issued_at: '', license_number: '' }],
      website: '',
    })

    const [, init] = mockFetch.mock.calls[0]
    const body = init?.body as FormData
    expect(body.get('street')).toBe('Kerkstraat')
    expect(body.get('house_number')).toBe('12')
    expect(body.get('postcode')).toBe('1234AB')
    expect(body.get('city')).toBe('Utrecht')
    expect(body.get('photo')).toBe(photo)
    expect(body.get('remarks')).toBe('Een vraag')
    expect(body.get('experiences[0][company]')).toBe('Acme Zorg')
    expect(body.get('experiences[0][title]')).toBe('Verpleegkundige')
    expect(body.get('educations[0][name]')).toBe('Diploma verpleegkunde')
    // Blank optional sub-fields are omitted entirely, never sent as an empty string.
    expect(body.get('experiences[0][location]')).toBeNull()
    expect(body.get('educations[0][organisation]')).toBeNull()
  })

  // A vacancy with every new optional field left empty must never send blank
  // strings/empty arrays for them — CLAUDE.md's "omit, don't send blank" rule.
  it('omits address/photo/remarks/experiences/educations entirely when not provided', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse({ status: 'applied', reference: 'APP-1' }, 201))
    await applyToVacancy('acme', 'REF-1', {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '+310612345678',
      website: '',
    })

    const [, init] = mockFetch.mock.calls[0]
    const body = init?.body as FormData
    expect(body.get('street')).toBeNull()
    expect(body.get('photo')).toBeNull()
    expect(body.get('remarks')).toBeNull()
    expect(body.get('experiences[0][company]')).toBeNull()
  })

  it('throws ApiError carrying the status, never the raw response body', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(mockJsonResponse('secret internal error trace', 500))
    await expect(fetchSite('acme')).rejects.toMatchObject({ status: 500 })
  })
})
