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
})
