/**
 * useSubmitState — the saving/errors/submitErr trio shared by every create/edit
 * submit hook that maps a 422 validation bag onto its own form fields and falls
 * back to a generic banner otherwise (useMatchSubmit, usePlanIntakeForm — the
 * identical catch-block idiom, DRY round 11). `failWith` is exactly what both
 * former catch blocks did inline: map the bag via the existing
 * lib/extractFormErrors, or fall back to extractApiError when the response
 * carries no bag at all.
 */
import { useCallback, useState } from 'react'
import { extractFormErrors } from '@/lib/extractFormErrors'
// DUP-04: one shared axios-error → message extractor, never a re-derived inline dance.
import { extractApiError } from '@/lib/extractApiError'

export interface UseSubmitStateResult {
  saving: boolean
  errors: Record<string, boolean>
  submitErr: string | null
  setSaving: (saving: boolean) => void
  setErrors: (errors: Record<string, boolean>) => void
  setSubmitErr: (err: string | null) => void
  /** Clears both error channels — call right before a submit attempt. */
  resetErrors: () => void
  /** Maps a thrown error onto field errors (422 bag) or the fallback banner. */
  failWith: (err: unknown, apiToForm: Record<string, string>, genericMessage: string) => void
}

// The saving flag + the two error channels (field-level vs a fallback banner) every submit hook needs.
export function useSubmitState(): UseSubmitStateResult {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  // Clears both channels — mirrors the `setErrors({}); setSubmitErr(null)` pair both former hooks ran right before a request.
  const resetErrors = useCallback(() => { setErrors({}); setSubmitErr(null) }, [])

  // Same branching as both former inline catch blocks: a 422 bag (even an empty one) maps onto field errors, anything else falls back to the server/generic message.
  const failWith = useCallback((err: unknown, apiToForm: Record<string, string>, genericMessage: string) => {
    const formErrors = extractFormErrors(err, apiToForm)
    if (formErrors) setErrors(formErrors)
    else setSubmitErr(extractApiError(err, genericMessage))
  }, [])

  return { saving, errors, submitErr, setSaving, setErrors, setSubmitErr, resetErrors, failWith }
}
