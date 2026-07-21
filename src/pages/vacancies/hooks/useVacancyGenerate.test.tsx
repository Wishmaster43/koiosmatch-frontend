/**
 * useVacancyGenerate — VACGEN-1 fase 1b. Verifies the resolve query only runs
 * once the flow is opened, generate() posts the resolved profile_id + this
 * vacancy's id + fields, and the 503/404/other failures map to distinct calm
 * states (never a raw crash) rather than only asserting a callback fired (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useVacancyGenerate } from './useVacancyGenerate'
import { mapVacancyDetail } from '../data/mapVacancy'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const vacancy = mapVacancyDetail({ id: 'v9', title: 'Verpleegkundige', contract_types: ['flex'], industry: 'Zorg' })

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset() })

describe('useVacancyGenerate', () => {
  it('does not resolve until the flow is opened, then generates with the resolved profile_id + base_vacancy_id', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: ['industry'] } })
    mockPost.mockResolvedValue({ data: { ok: true, concept: 'Concepttekst…', model: 'claude-x', profile_id: 'p1' } })

    const { result } = renderHook(() => useVacancyGenerate(vacancy), { wrapper })
    expect(mockGet).not.toHaveBeenCalled()

    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).toEqual({ profileId: 'p1', name: 'Zorg', specificity: 1, matchedDims: ['industry'] }))

    await act(async () => { await result.current.generate() })
    expect(mockPost).toHaveBeenCalledWith('/vacancies/generate',
      { profile_id: 'p1', base_vacancy_id: 'v9', fields: { contract_form: 'flex', industry: 'Zorg' } },
      expect.objectContaining({ timeout: 60000 }))
    expect(result.current.status).toBe('success')
    expect(result.current.concept).toBe('Concepttekst…')
  })

  it('maps a 503 to the "unavailable" status, never a raw crash', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: [] } })
    mockPost.mockRejectedValue({ response: { status: 503 } })

    const { result } = renderHook(() => useVacancyGenerate(vacancy), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    await act(async () => { await result.current.generate() })

    expect(result.current.status).toBe('unavailable')
    expect(result.current.concept).toBe('')
  })

  it('shows the calm "no profile configured" state instead of calling generate when the tenant has none', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } })

    const { result } = renderHook(() => useVacancyGenerate(vacancy), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.noProfileConfigured).toBe(true))

    await act(async () => { await result.current.generate() })
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.status).toBe('noProfile')
  })

  it('discard() clears the concept but keeps the flow open; closeFlow() resets everything', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: [] } })
    mockPost.mockResolvedValue({ data: { ok: true, concept: 'Concept A', model: 'claude-x', profile_id: 'p1' } })

    const { result } = renderHook(() => useVacancyGenerate(vacancy), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    await act(async () => { await result.current.generate() })
    expect(result.current.status).toBe('success')

    act(() => result.current.discard())
    expect(result.current.status).toBe('idle')
    expect(result.current.concept).toBe('')
    expect(result.current.open).toBe(true)

    act(() => result.current.closeFlow())
    expect(result.current.open).toBe(false)
  })
})
