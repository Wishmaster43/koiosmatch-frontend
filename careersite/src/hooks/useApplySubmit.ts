import { useState } from 'react'
import { applyToVacancy } from '../api'
import { strings } from '../strings'

export type ApplyStatus = 'idle' | 'submitting' | 'success' | 'error'

export interface ApplyFormValues {
  firstName: string
  lastName: string
  email: string
  phone: string
  motivation: string
  cv: File | null
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
        website: values.website,
      })
      setState({ status: 'success', errorMessage: null, reference: res.reference })
    } catch {
      setState({ status: 'error', errorMessage: strings.apply.errorGeneric, reference: null })
    }
  }

  return { ...state, submit }
}
