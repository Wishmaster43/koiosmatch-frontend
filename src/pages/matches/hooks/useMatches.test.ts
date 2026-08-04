/**
 * useMatches — regression test for the flat FK mapping (candidateId/vacancyId/
 * clientId) that the Relations tab's cross-entity hyperlinks depend on (§3A).
 * Before this fix, mapMatch dropped these ids entirely, so every EntityLink in
 * RelationsTab silently degraded to plain (unlinked) text.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMatches } from './useMatches'
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
