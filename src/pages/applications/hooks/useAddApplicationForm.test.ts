/**
 * useAddApplicationForm — ONIX N-005: a 422 bag key no form field maps to (a
 * required tenant custom field) gets a notifyError banner too, alongside the
 * existing field-errors/toast fallback.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useAddApplicationForm } from './useAddApplicationForm'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), patch: vi.fn() }, unwrap: (r: { data: { data: unknown } }) => r.data.data }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

afterEach(() => { vi.clearAllMocks() })

const mountHook = () => renderHook(() => useAddApplicationForm({
  candidateId: 'cand-1', vacancyOptions: [], stages: [], defaultStage: undefined, userOptions: [],
  meIsAssignable: false, vacancyRequired: false, phaseRequired: false, ownerRequired: false, sourceRequired: false,
  onCreated: vi.fn(), onClose: vi.fn(),
}))

describe('useAddApplicationForm · unmapped 422 banner (ONIX N-005)', () => {
  it('notifies the unmapped key when no field maps to it', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } },
    })
    const { result } = mountHook()
    await act(async () => { await result.current.submit() })
    expect(notifyError).toHaveBeenCalledWith(expect.stringContaining('common:validation.fieldRequiredNamed'))
    // ONIX N-005 verifier: only the unrendered dotted key is flagged, no form key.
    expect(result.current.errors).toEqual({ 'custom_fields.vog': true })
  })
})

describe('useAddApplicationForm · single toast on an unmapped-only 422', () => {
  it('fires exactly one toast (the banner) when the 422 carries only an unmapped key', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 422, data: { message: 'invalid', errors: { 'custom_fields.x': ['The custom_fields.x field is required.'] } } },
    })
    const { result } = mountHook()
    await act(async () => { await result.current.submit() })
    expect(notifyError).toHaveBeenCalledTimes(1)
    expect(notifyError).toHaveBeenCalledWith(expect.stringContaining('common:validation.fieldRequiredNamed'))
  })
})

describe('useAddApplicationForm · interview consent (ONIX K-006)', () => {
  it('POSTs interview_consent: true only after the box is ticked', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const { result } = mountHook()
    act(() => { result.current.setInterviewConsent(true) })
    await act(async () => { await result.current.submit() })
    expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/applications')
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ candidate_id: 'cand-1', interview_consent: true })
  })

  it('omits the interview_consent key by default', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const { result } = mountHook()
    await act(async () => { await result.current.submit() })
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('interview_consent')
  })
})
