/**
 * useMatches — regression test for the flat FK mapping (candidateId/vacancyId/
 * clientId) that the Relations tab's cross-entity hyperlinks depend on (§3A).
 * Before this fix, mapMatch dropped these ids entirely, so every EntityLink in
 * RelationsTab silently degraded to plain (unlinked) text.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMatches, MATCHES_MAX_PER_PAGE } from './useMatches'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// An avatar_color value straight off the API payload under test — DATA, not UI styling.
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
const OWNER_COLOR = '#123456'

describe('useMatches', () => {
  it('maps the flat candidate_id/vacancy_id/customer_id FKs onto the row', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [{
          id: 'm1', candidate_id: 'c1', vacancy_id: 'v1', customer_id: 'cu1',
          candidate: { name: 'Sam de Vries' }, vacancy: { title: 'Verpleegkundige' },
          client_name: 'Zorggroep Noord',
        }],
        meta: { last_page: 1 },
      },
    })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0]).toMatchObject({ candidateId: 'c1', vacancyId: 'v1', clientId: 'cu1' })
  })

  // MATCH-OWNER-1: the resource carries owner.id (MatchListResource.php:50) but the
  // mapper dropped it, so the drawer's picker had nothing to preselect against.
  it('maps the owner id alongside the name/colour', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [{ id: 'm1', owner: { id: 'u-9', name: 'Piet de Vries', avatar_color: OWNER_COLOR } }],
        meta: { last_page: 1 },
      },
    })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ ownerId: 'u-9', owner: 'Piet de Vries', ownerInitials: 'PD', ownerColor: OWNER_COLOR })
  })

  it('leaves ownerId null on an ownerless row', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'm1' }], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0].ownerId).toBeNull()
  })

  it('falls back to the nested objects\' ids when the flat FK is absent', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [{ id: 'm2', candidate: { id: 'c2', name: 'Alex' }, vacancy: { id: 'v2', title: 'Verzorgende' } }],
        meta: { last_page: 1 },
      },
    })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ candidateId: 'c2', vacancyId: 'v2' })
  })

  it('leaves the FKs null (never undefined-crashes) when the row carries none', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'm3' }], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ candidateId: null, vacancyId: null, clientId: null })
  })

  // M1 (overzicht-data cluster): MatchListResource already ships `contract_type`
  // on every list row — the mapper was dropping it, so Overview had no way to
  // show it without a second detail fetch.
  it('maps contract_type onto contractType', async () => {
    mockedGet.mockResolvedValue({
      data: { data: [{ id: 'm6', contract_type: 'detachering' }], meta: { last_page: 1 } },
    })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ contractType: 'detachering' })
  })

  it('leaves contractType null when the row carries none', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'm7' }], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0].contractType).toBeNull()
  })
})

// MATCH-ORIGIN-1: ONTSTAANSTYPE (direct vs via sollicitatie), OFFERED-IFF-READ —
// the backend doesn't ship `application_id` on the list resource yet, so the
// mapper gates on KEY PRESENCE, never a value read off an absent key.
describe('useMatches · origin field (MATCH-ORIGIN-1, OFFERED-IFF-READ)', () => {
  it('leaves origin undefined when the payload carries no application_id key at all', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'm1' }], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0].origin).toBeUndefined()
  })

  it('maps origin to "direct" when the key is present but null (a real direct match)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'm1', application_id: null }], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0].origin).toBe('direct')
  })

  it('maps origin to "application" when application_id carries a value', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'm1', application_id: 'a-9' }], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0].origin).toBe('application')
  })
})

describe('useMatches · MATCH-ARCHIVED-LIST-1', () => {
  it('maps archived + deleted_at onto the row', async () => {
    mockedGet.mockResolvedValue({
      data: { data: [{ id: 'm4', archived: true, deleted_at: '2026-07-10T00:00:00Z' }], meta: { last_page: 1 } },
    })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ archived: true, archivedAt: '2026-07-10T00:00:00Z' })
  })

  it('defaults archived to false when the resource omits both fields', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'm5' }], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ archived: false, archivedAt: null })
  })

  it('never sends include_archived when the toggle is off', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/matches', { params: expect.not.objectContaining({ include_archived: expect.anything() }) })
  })

  it('sends include_archived: 1 (numeric, not a JS boolean) when the toggle is on', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches(null, true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/matches', { params: expect.objectContaining({ include_archived: 1 }) })
  })

  it('also rides include_archived on the exact ref-number lookup', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches('M-00042', true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/matches', { params: { ref: 'M-00042', include_archived: 1 } })
  })
})

// §13 seam guard: GET /matches 422s above per_page=500 (MatchQuery::rules()) while
// the FE's shared page-size dropdown (useListPageSize, PAGE_SIZE_OPTIONS) offers up
// to 500 — this hook is the only thing that ever calls GET /matches, and it never
// takes the UI's pageSize as an argument (MatchesPage slices the already-fetched
// full set in-memory instead, see MatchesPage.tsx), so the request itself must
// always stay pinned to MATCHES_MAX_PER_PAGE regardless of any stored preference.
describe('useMatches · per_page cap (MATCHES_MAX_PER_PAGE, seam-harness 2026-08-05)', () => {
  it('names the cap 500 — the measured MatchQuery ceiling', () => {
    expect(MATCHES_MAX_PER_PAGE).toBe(500)
  })

  it('sends exactly MATCHES_MAX_PER_PAGE on the first page of the fetch-all loop', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/matches', { params: { per_page: MATCHES_MAX_PER_PAGE, page: 1 } })
  })

  it('never exceeds per_page=500 across a multi-page fetch, even with many pages available', async () => {
    // Three server pages available — the loop must keep requesting at exactly the
    // capped per_page on every page, never creep upward.
    mockedGet.mockResolvedValue({ data: { data: [], meta: { last_page: 3 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const matchCalls = mockedGet.mock.calls.filter(c => c[0] === '/matches')
    expect(matchCalls).toHaveLength(3)
    matchCalls.forEach(call => {
      const params = (call[1] as { params?: Record<string, unknown> })?.params
      expect(params?.per_page).toBe(500)
      expect(Number(params?.per_page)).toBeLessThanOrEqual(500)
    })
  })

  it('keeps the request pinned at 500 even with a 900 stored user preference (default_per_page)', async () => {
    // useMatches doesn't accept a pageSize/serverCap argument at all — the stored
    // preference lives entirely in useListPageSize/MatchesPage and never reaches
    // this hook. Calling it exactly as MatchesPage does (no pageSize passed
    // through) proves the request stays capped independent of whatever the tenant's
    // default_per_page or a remembered dropdown pick is set to.
    mockedGet.mockResolvedValue({ data: { data: [], meta: { last_page: 1 } } })
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const matchCall = mockedGet.mock.calls.find(c => c[0] === '/matches')
    expect(matchCall?.[1]?.params).toMatchObject({ per_page: 500 })
    expect(matchCall?.[1]?.params).not.toMatchObject({ per_page: 900 })
  })
})

// TRASH-OVERAL-2: the trash lifecycle rides on every mapped row — straight from
// the resource when present, tolerantly derived from deleted_at when absent.
describe('useMatches · trash lifecycle mapping (TRASH-OVERAL-2)', () => {
  it('maps lifecycle + pending_erase_at onto the row', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [{ id: 'm5', archived: true, deleted_at: '2026-08-01T00:00:00Z', lifecycle: 'pending_erase', pending_erase_at: '2026-08-10T12:00:00Z' }],
        meta: { last_page: 1 },
      },
    })
    const { result } = renderHook(() => useMatches(null, true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ lifecycle: 'pending_erase', pendingEraseAt: '2026-08-10T12:00:00Z' })
  })

  it('derives archived/active when the resource predates the lifecycle field', async () => {
    mockedGet.mockResolvedValue({
      data: { data: [{ id: 'm6', deleted_at: '2026-08-01T00:00:00Z' }, { id: 'm7' }], meta: { last_page: 1 } },
    })
    const { result } = renderHook(() => useMatches(null, true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ lifecycle: 'archived', pendingEraseAt: null })
    expect(result.current.rows[1]).toMatchObject({ lifecycle: 'active' })
  })
})
