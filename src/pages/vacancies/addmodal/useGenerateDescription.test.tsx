/**
 * useGenerateDescription — punt 17. Mirrors useVacancyGenerate.test.tsx: the
 * resolve query only runs once the flow is opened, generate() posts the
 * resolved profile_id + fields built from the CREATE FORM's own values (never
 * a base_vacancy_id — the vacancy doesn't exist yet), and 503/404/other
 * failures map to distinct calm states (never a raw crash, §13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useGenerateDescription } from './useGenerateDescription'
import type { GenerateFormFields } from './useGenerateDescription'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const fields: GenerateFormFields = {
  title: 'Verpleegkundige', category: 'Verpleegkundige', industry: 'Zorg', contractTypes: ['flex'],
  city: 'Den Haag', hoursMin: '20', hoursMax: '32', customerName: 'Rivas Zorggroep',
}

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset() })

describe('useGenerateDescription', () => {
  it('does not resolve until opened, then generates WITHOUT a base_vacancy_id (the vacancy does not exist yet)', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: ['industry'] } })
    mockPost.mockResolvedValue({ data: { ok: true, concept: 'Concepttekst…', model: 'claude-x', profile_id: 'p1' } })

    const { result } = renderHook(() => useGenerateDescription(fields), { wrapper })
    expect(mockGet).not.toHaveBeenCalled()

    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).toEqual({ profileId: 'p1', name: 'Zorg', specificity: 1, matchedDims: ['industry'] }))

    await act(async () => { await result.current.generate() })
    expect(mockPost).toHaveBeenCalledWith('/vacancies/generate', {
      profile_id: 'p1',
      base_vacancy_id: undefined,
      fields: { job_title: 'Verpleegkundige', location: 'Den Haag', contract_form: 'flex', industry: 'Zorg', customer_name: 'Rivas Zorggroep', hours: '20-32' },
    }, expect.objectContaining({ timeout: 60000 }))
    expect(result.current.status).toBe('success')
    expect(result.current.concept).toBe('Concepttekst…')
  })

  it('maps a 503 to the "unavailable" status, never a raw crash', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: [] } })
    mockPost.mockRejectedValue({ response: { status: 503 } })

    const { result } = renderHook(() => useGenerateDescription(fields), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    await act(async () => { await result.current.generate() })

    expect(result.current.status).toBe('unavailable')
    expect(result.current.concept).toBe('')
  })

  // Regression (PLAN-KANDIDATEN batch 2): 402 used to fall through to the
  // generic 'error' status while a real 503 wore the "no AI credit" copy — the
  // 402/503 semantics were reversed. A 402 must map to its OWN 'creditExhausted'
  // status and carry the house apiErrorKey, never the generic failure.
  it('maps a 402 to the "creditExhausted" status with the apiErrorKey code, never the generic error', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: [] } })
    mockPost.mockRejectedValue({ response: { status: 402, data: { code: 'koios_credit_exhausted' } } })

    const { result } = renderHook(() => useGenerateDescription(fields), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    await act(async () => { await result.current.generate() })

    expect(result.current.status).toBe('creditExhausted')
    expect(result.current.errorKey).toBe('errors.koiosCreditExhausted')
    expect(result.current.concept).toBe('')
  })

  // A real 500 must never be silenced as one of the calm known-code states.
  it('maps a 500 to the generic "error" status, not "creditExhausted"/"unavailable"', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: [] } })
    mockPost.mockRejectedValue({ response: { status: 500 } })

    const { result } = renderHook(() => useGenerateDescription(fields), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    await act(async () => { await result.current.generate() })

    expect(result.current.status).toBe('error')
  })

  it('maps a 404 to "noProfile" (no dead retry loop)', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: [] } })
    mockPost.mockRejectedValue({ response: { status: 404 } })

    const { result } = renderHook(() => useGenerateDescription(fields), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.profile).not.toBeNull())
    await act(async () => { await result.current.generate() })

    expect(result.current.status).toBe('noProfile')
  })

  it('shows "no profile configured" instead of calling generate when the tenant has none', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } })

    const { result } = renderHook(() => useGenerateDescription(fields), { wrapper })
    act(() => result.current.openFlow())
    await waitFor(() => expect(result.current.noProfileConfigured).toBe(true))

    await act(async () => { await result.current.generate() })
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.status).toBe('noProfile')
  })

  it('discard() clears the concept but keeps the flow open; closeFlow() resets everything', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg' }, specificity: 1, matched_dims: [] } })
    mockPost.mockResolvedValue({ data: { ok: true, concept: 'Concept A', model: 'claude-x', profile_id: 'p1' } })

    const { result } = renderHook(() => useGenerateDescription(fields), { wrapper })
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
