/**
 * useCreateApplication — ONIX N-005: a 422 bag key no form field maps to (a
 * required tenant custom field) wins the createError banner over the generic
 * message, since it names the real reason.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useCreateApplication } from './useCreateApplication'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() }, unwrap: (r: { data: { data: unknown } }) => r.data.data }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ funnelTypes: [] }) }))

afterEach(() => { vi.clearAllMocks() })

const mountHook = (onCreated = vi.fn()) => renderHook(() => useCreateApplication({
  candidateId: 'cand-1', vacancyId: '', ownerId: '', phaseId: '', source: '', sourceKey: null,
  customFieldValues: {}, vacancyRequired: false, ownerRequired: false, phaseRequired: false, sourceRequired: false,
  appRuleBlocked: false, onCreated,
}))

describe('useCreateApplication · unmapped 422 banner (ONIX N-005)', () => {
  it('sets createError from the unmapped key when no field maps to it', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } },
    })
    const { result } = mountHook()
    await act(async () => { await result.current.create() })
    expect(result.current.createError).toContain('common:validation.fieldRequiredNamed')
    // ONIX N-005 verifier: only the unrendered dotted key is flagged, no form key.
    expect(result.current.errors).toEqual({ 'custom_fields.vog': true })
  })
})

describe('useCreateApplication · interview consent (ONIX K-006)', () => {
  const mountWith = (interviewConsent?: boolean) => renderHook(() => useCreateApplication({
    candidateId: 'cand-1', vacancyId: '', ownerId: '', phaseId: '', source: '', sourceKey: null,
    customFieldValues: {}, vacancyRequired: false, ownerRequired: false, phaseRequired: false, sourceRequired: false,
    appRuleBlocked: false, interviewConsent, onCreated: vi.fn(),
  }))

  it('POSTs /applications with interview_consent: true when ticked', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'a1' } } })
    const { result } = mountWith(true)
    await act(async () => { await result.current.create() })
    expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/applications')
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ candidate_id: 'cand-1', interview_consent: true })
  })

  it('omits the interview_consent key when unticked', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'a1' } } })
    const { result } = mountWith(false)
    await act(async () => { await result.current.create() })
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('interview_consent')
  })
})
