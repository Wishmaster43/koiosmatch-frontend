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
