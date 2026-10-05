/**
 * useAddVacancySubmit — ONIX N-005: a 422 bag key no form field maps to (a
 * required tenant custom field) must still surface as a banner via
 * setCreateError, never a silent failed submit.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useAddVacancySubmit } from './useAddVacancySubmit'
import type { VacancyCreateForm } from './useAddVacancyForm'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() }, unwrap: (r: { data: { data: unknown } }) => r.data.data }))

afterEach(() => { vi.clearAllMocks() })

const baseForm: VacancyCreateForm = {
  title: 'Verpleegkundige', status: '', ownerId: '', clientId: '', industry: '', category: '',
  contractTypes: [], startDate: '', endDate: '', positionsNeeded: '',
  street: '', houseNumber: '', houseNumberSuffix: '', addressLine2: '', postalCode: '', city: '', province: '', country: '',
  branchId: '', seniority: '', education: '', salaryMin: '', salaryMax: '', salaryPeriod: '', hoursMin: '', hoursMax: '', description: '',
}

// Echoes the key plus its interpolation options, so a banner test can assert
// the FIELD NAME made it through formatUnmappedErrors without a real i18n instance.
const tStub = ((k: string, opts?: Record<string, unknown>) => (opts ? `${k}::${JSON.stringify(opts)}` : k)) as unknown as Parameters<typeof useAddVacancySubmit>[0]['t']

const mountHook = (setCreateError: (v: string | null) => void, setErrors: (v: unknown) => void) => renderHook(() => useAddVacancySubmit({
  setErrors, setCreateError,
  form: baseForm, cascade: { customerLocationId: '', customerDepartmentId: '', contactId: '' },
  skills: [], channels: [], matchWeightTemplateId: '', matchWeights: null, aiAgentId: '', interviewWorkflowId: '',
  applicationSettings: {}, applicationSettingsTouched: false, showAttachmentCards: false,
  attachments: { hasPending: false, runSequence: vi.fn() },
  onClose: vi.fn(), t: tStub,
}))

describe('useAddVacancySubmit · unmapped 422 banner (ONIX N-005)', () => {
  it('calls setCreateError with the unmapped key when no field maps to it', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } },
    })
    const setCreateError = vi.fn()
    const setErrors = vi.fn()
    const { result } = mountHook(setCreateError, setErrors)
    await act(async () => { await result.current.handleSubmit() })
    expect(setCreateError).toHaveBeenLastCalledWith(expect.stringContaining('vog'))
    // ONIX N-005 verifier: only the unrendered dotted key is flagged, no form key.
    expect(setErrors).toHaveBeenCalledWith({ 'custom_fields.vog': true })
  })
})
