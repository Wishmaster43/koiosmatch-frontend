/**
 * useCreateCandidateSubmit — request-seam test (§13) for the ONIX N-005 custom-
 * fields wiring: the create body carries `custom_fields` only when non-empty,
 * and a 422 on a required-but-missing custom field sets the dotted error flag
 * without also firing the generic unmapped-error banner (renderedKeys covers it).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCreateCandidateSubmit } from './useCreateCandidateSubmit'
import type { FormState } from '../AddCandidateModal'

const baseForm: FormState = {
  firstName: 'Jan', middleName: '', lastName: 'Jansen', functionTitle: '',
  email: '', phone: '', mobile: '', dateOfBirth: '', gender: '', preferredLanguage: '',
  street: '', houseNumber: '', houseNumberSuffix: '', addressLine2: '', postalCode: '', city: '', province: '', country: '',
  ownerId: '1', summary: '', linkedin: '',
}

// t stub: echoes the key so a test can assert ON the translation call shape.
const t = ((key: string) => key) as unknown as Parameters<typeof useCreateCandidateSubmit>[0]['t']

function setup(createCandidate: ReturnType<typeof vi.fn>, extra?: Partial<Parameters<typeof useCreateCandidateSubmit>[0]>) {
  const setErrors = vi.fn()
  const setSubmitErr = vi.fn()
  const setFieldMessages = vi.fn()
  const setDupBlock = vi.fn()
  const onCreated = vi.fn()
  const onClose = vi.fn()
  const { result } = renderHook(() => useCreateCandidateSubmit({
    setErrors, setSubmitErr, setFieldMessages, setDupBlock,
    form: baseForm, status: 'lead', branchIds: [], requiredForm: [], touchInvalidFields: () => [],
    createCandidate, onCreated, onClose, t, ...extra,
  }))
  return { result, setErrors, setSubmitErr, setFieldMessages, setDupBlock, onCreated, onClose }
}

describe('useCreateCandidateSubmit — custom fields (ONIX N-005)', () => {
  it('omits custom_fields from the body when none are set', async () => {
    const createCandidate = vi.fn().mockResolvedValue({ id: '1' })
    const { result } = setup(createCandidate)
    await act(async () => { await result.current.handleSubmit() })
    const body = createCandidate.mock.calls[0][0]
    expect(body).not.toHaveProperty('custom_fields')
  })

  it('carries custom_fields in the body when at least one value is set', async () => {
    const createCandidate = vi.fn().mockResolvedValue({ id: '1' })
    const { result } = setup(createCandidate, { customFields: { vog: 'yes' } })
    await act(async () => { await result.current.handleSubmit() })
    const body = createCandidate.mock.calls[0][0]
    expect(body.custom_fields).toEqual({ vog: 'yes' })
  })

  it('on a 422 for a required custom field: sets the dotted error flag and does NOT fire the unmapped banner (renderedKeys covers it)', async () => {
    const err = { response: { status: 422, data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } } }
    const createCandidate = vi.fn().mockRejectedValue(err)
    const { result, setErrors, setFieldMessages, setSubmitErr } = setup(createCandidate, { renderedKeys: ['custom_fields.vog'] })
    await act(async () => { await result.current.handleSubmit() })
    expect(setErrors).toHaveBeenCalledWith({ 'custom_fields.vog': true })
    expect(setFieldMessages).toHaveBeenCalledWith({ 'custom_fields.vog': 'The custom_fields.vog field is required.' })
    expect(setSubmitErr).not.toHaveBeenCalledWith(expect.any(String))
  })

  it('on a 422 for a required custom field with NO renderedKeys: the unmapped banner DOES fire', async () => {
    const err = { response: { status: 422, data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } } }
    const createCandidate = vi.fn().mockRejectedValue(err)
    const { result, setSubmitErr } = setup(createCandidate)
    await act(async () => { await result.current.handleSubmit() })
    expect(setSubmitErr).toHaveBeenCalledWith(expect.any(String))
  })
})
