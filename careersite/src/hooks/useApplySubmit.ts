import { useState } from 'react'
import { applyToVacancy } from '../api'
import { strings } from '../strings'
import type { EducationEntry, ExperienceEntry } from '../types'

export type ApplyStatus = 'idle' | 'submitting' | 'success' | 'error'

export interface ApplyFormValues {
  firstName: string
  lastName: string
  email: string
  phone: string
  motivation: string
  cv: File | null
  // Address block (CAREERSITE-APPLY-2) — always optional.
  street: string
  houseNumber: string
  postcode: string
  city: string
  // Profile photo — only meaningful when the vacancy's setting is not 'hidden'.
  photo: File | null
  remarks: string
  experiences: ExperienceEntry[]
  educations: EducationEntry[]
  // Honeypot — always sent, expected empty; a real visitor never sees or fills this field.
  website: string
}

interface ApplySubmitState {
  status: ApplyStatus
  errorMessage: string | null
  reference: string | null
}

// Wraps the apply POST with request status and a safe, translated error message —
// the raw server error body is never surfaced to the applicant (CLAUDE.md §10).
export function useApplySubmit(tenant: string | undefined, reference: string | undefined) {
  const [state, setState] = useState<ApplySubmitState>({ status: 'idle', errorMessage: null, reference: null })

  const submit = async (values: ApplyFormValues) => {
    if (!tenant || !reference) return
    setState({ status: 'submitting', errorMessage: null, reference: null })
    try {
      const res = await applyToVacancy(tenant, reference, {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        phone: values.phone,
        motivation: values.motivation || undefined,
        cv: values.cv,
        street: values.street || undefined,
        house_number: values.houseNumber || undefined,
        postcode: values.postcode || undefined,
        city: values.city || undefined,
        photo: values.photo,
        remarks: values.remarks || undefined,
        experiences: values.experiences,
        educations: values.educations,
        website: values.website,
      })
      setState({ status: 'success', errorMessage: null, reference: res.reference })
    } catch {
      setState({ status: 'error', errorMessage: strings.apply.errorGeneric, reference: null })
    }
  }

  return { ...state, submit }
}
